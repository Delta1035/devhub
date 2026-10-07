import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { z } from 'zod'
import {
  devhubApiMethods,
  isRemoteAllowed,
  remoteApiPrefix,
  remoteProtocolVersion,
  type DevhubApi,
  type DevhubApiMethod,
  type IpcResult,
  type RemoteErrorCode,
  type RemoteInfo,
  type RemoteSession
} from '@devhub/shared'
import { toIpcResult } from '../api-result'
import { bearerToken, createFailureLimiter, tokensEqual, type FailureLimiter } from './auth'
import { applyCors } from './cors'
import { openEventStream, type EventStreamOptions } from './event-stream'
import { serveStaticFile } from './static-files'

export interface RemoteServerOptions extends EventStreamOptions {
  api: DevhubApi
  /** IP address to listen on. */
  host: string
  /** 0 picks a free port (tests). */
  port: number
  token: string
  allowTerminal: boolean
  limiter?: FailureLimiter
  maxBodyBytes?: number
  /** Built web app served outside `/api`; absent in dev builds that did not build it. */
  webRoot?: string
}

export interface RemoteServer {
  /** The port actually listened on. */
  port: number
  /** Stops listening and drops open connections. */
  close(): Promise<void>
}

type AnyApiMethod = (...args: unknown[]) => Promise<unknown>

const methods = new Set<string>(devhubApiMethods)
const requestSchema = z.object({ args: z.array(z.unknown()).max(8).default([]) })

/**
 * The remote transport of DevhubApi (ADR 0022): `POST /api/v1/<method>` with `{ "args": [...] }`,
 * answered with the same `IpcResult` envelope as IPC. Arguments are validated by the core services,
 * exactly as for IPC; this layer only authenticates, applies `remoteAccess` and bounds the body.
 * `GET /api/v1/events` streams core events as SSE (`event-stream.ts`).
 */
export function startRemoteServer({
  api,
  host,
  port,
  token,
  allowTerminal,
  limiter = createFailureLimiter(),
  maxBodyBytes = 1024 * 1024,
  subscribe,
  heartbeatMs,
  maxBufferedBytes,
  webRoot
}: RemoteServerOptions): Promise<RemoteServer> {
  // Ended explicitly on close, so no subscription outlives the server.
  const streams = new Set<{ end(): void }>()

  /** Answers 429 / 401 itself and returns false when the request may not proceed. */
  const authorized = (request: IncomingMessage, response: ServerResponse): boolean => {
    const address = request.socket.remoteAddress ?? ''
    if (limiter.isBlocked(address)) {
      reject(response, 429, 'TOO_MANY_REQUESTS')
      return false
    }
    const given = bearerToken(request.headers.authorization)
    if (given === null || !tokensEqual(given, token)) {
      limiter.recordFailure(address)
      reject(response, 401, 'UNAUTHORIZED', { 'www-authenticate': 'Bearer' })
      return false
    }
    return true
  }

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    // Everything outside /api is the web app.
    if (path !== '/api' && !path.startsWith('/api/')) {
      return serveStaticFile(request, response, webRoot)
    }
    if (applyCors(request, response)) return

    if (path === `${remoteApiPrefix}/info`) {
      if (request.method !== 'GET')
        return reject(response, 405, 'METHOD_NOT_ALLOWED', { allow: 'GET' })
      const info: RemoteInfo = { protocol: remoteProtocolVersion }
      return send(response, 200, info)
    }

    if (path === `${remoteApiPrefix}/session`) {
      if (request.method !== 'GET')
        return reject(response, 405, 'METHOD_NOT_ALLOWED', { allow: 'GET' })
      if (!authorized(request, response)) return
      const session: RemoteSession = { protocol: remoteProtocolVersion, allowTerminal }
      return send(response, 200, session)
    }

    if (path === `${remoteApiPrefix}/events`) {
      if (request.method !== 'GET')
        return reject(response, 405, 'METHOD_NOT_ALLOWED', { allow: 'GET' })
      if (!authorized(request, response)) return
      const stream = openEventStream(response, { subscribe, heartbeatMs, maxBufferedBytes }, () =>
        streams.delete(stream)
      )
      streams.add(stream)
      return
    }

    const name = path.startsWith(`${remoteApiPrefix}/`)
      ? path.slice(remoteApiPrefix.length + 1)
      : ''
    if (!methods.has(name)) return reject(response, 404, 'NOT_FOUND')
    const method = name as DevhubApiMethod
    if (request.method !== 'POST')
      return reject(response, 405, 'METHOD_NOT_ALLOWED', { allow: 'POST' })

    if (!authorized(request, response)) return
    if (!isRemoteAllowed(method, { allowTerminal })) return reject(response, 403, 'FORBIDDEN')
    if (!/^application\/json\s*(;|$)/i.test(request.headers['content-type'] ?? '')) {
      return reject(response, 415, 'UNSUPPORTED_MEDIA_TYPE')
    }

    const body = await readBody(request, maxBodyBytes)
    if (body === null) return reject(response, 413, 'PAYLOAD_TOO_LARGE', { connection: 'close' })
    const parsed = requestSchema.safeParse(parseJson(body))
    if (!parsed.success) return reject(response, 400, 'BAD_REQUEST')

    const handler = api[method] as AnyApiMethod
    send(response, 200, await toIpcResult(`remote:${method}`, () => handler(...parsed.data.args)))
  }

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      console.error('[remote] request failed', error)
      if (!response.headersSent) {
        send(response, 500, { ok: false, error: { code: 'INTERNAL', message: '内部错误' } })
      } else response.destroy()
    })
  })
  server.headersTimeout = 10_000
  server.requestTimeout = 30_000

  return new Promise((resolve, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(port, host, () => {
      server.off('error', rejectListen)
      const address = server.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise((resolveClose) => {
            for (const stream of [...streams]) stream.end()
            server.close(() => resolveClose())
            server.closeAllConnections()
          })
      })
    })
  })
}

const messages: Record<RemoteErrorCode, string> = {
  UNAUTHORIZED: '访问令牌无效',
  FORBIDDEN: '远程访问不允许此操作',
  NOT_FOUND: '没有这个接口',
  METHOD_NOT_ALLOWED: '请求方法不支持',
  BAD_REQUEST: '请求格式无效',
  PAYLOAD_TOO_LARGE: '请求内容过大',
  UNSUPPORTED_MEDIA_TYPE: '请求内容必须是 JSON',
  TOO_MANY_REQUESTS: '验证失败次数过多，请稍后再试'
}

function reject(
  response: ServerResponse,
  status: number,
  code: RemoteErrorCode,
  headers: Record<string, string> = {}
): void {
  const body: IpcResult<never> = { ok: false, error: { code, message: messages[code] } }
  send(response, status, body, headers)
}

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers
  })
  response.end(JSON.stringify(body))
}

/** The body as text, or null once it exceeds the limit (the rest is not read). */
function readBody(request: IncomingMessage, limit: number): Promise<string | null> {
  if (Number(request.headers['content-length'] ?? 0) > limit) return Promise.resolve(null)
  return new Promise((resolve, rejectRead) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        request.removeAllListeners('data')
        request.pause()
        resolve(null)
      } else chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', rejectRead)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
