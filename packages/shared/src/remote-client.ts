import { devhubApiMethods, type DevhubApi, type IpcResult } from './api'
import type { DevhubEvent, DevhubEvents } from './events'
import { remoteApiPrefix, type RemoteSession } from './remote'

/*
 * HTTP + SSE client for the remote API (ADR 0022), shared by the PWA and a future mobile app.
 * The platform pieces (fetch, text decoding, timers) are injected: this package has no DOM or
 * Node typings, and React Native differs from browsers in exactly these.
 */

export interface StreamReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>
  cancel(): Promise<void>
}

export interface FetchResponse {
  status: number
  json(): Promise<unknown>
  body: { getReader(): StreamReader } | null
}

export type FetchFn = (
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string }
) => Promise<FetchResponse>

export interface RemoteClientOptions {
  /**
   * Origin of the desktop's remote server; `''` for the same origin (the hosted PWA). A function
   * is read on every request, so a client that lets the user pick the desktop keeps one client.
   */
  baseUrl: string | (() => string)
  /** Read on every request, so a new token applies without recreating the client. */
  token: () => string
  fetch: FetchFn
  /** Creates a streaming UTF-8 decoder (one per event stream). */
  createDecoder: () => (chunk: Uint8Array) => string
  delay: (ms: number) => Promise<void>
  /** The token was rejected; the UI should ask for a new one. */
  onUnauthorized?: () => void
  /** Waits between event stream reconnects; the last value repeats. */
  retryDelaysMs?: readonly number[]
}

/** A failed remote call. `code` is the core's `DevhubError` code or a transport code. */
export class RemoteError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'RemoteError'
  }
}

export interface RemoteEvents extends DevhubEvents {
  /**
   * Called each time the event stream is (re)established. Events missed while disconnected are
   * not replayed, so listeners refetch state here.
   */
  onReady(listener: () => void): () => void
}

export interface RemoteClient {
  api: DevhubApi
  events: RemoteEvents
  /** Checks the token and returns what this client may do. */
  session(): Promise<RemoteSession>
}

export function createRemoteClient(options: RemoteClientOptions): RemoteClient {
  const url = (path: string): string => {
    const base = typeof options.baseUrl === 'function' ? options.baseUrl() : options.baseUrl
    return `${base}${remoteApiPrefix}${path}`
  }
  const auth = (): Record<string, string> => ({ authorization: `Bearer ${options.token()}` })

  const request = async (
    path: string,
    init: { method: 'GET' | 'POST'; body?: string }
  ): Promise<{ status: number; body: unknown }> => {
    let response: FetchResponse
    try {
      const headers =
        init.body === undefined ? auth() : { ...auth(), 'content-type': 'application/json' }
      response = await options.fetch(url(path), { ...init, headers })
    } catch {
      throw new RemoteError('NETWORK', '无法连接到 DevHub，请检查网络和远程访问设置', 0)
    }
    if (response.status === 401) options.onUnauthorized?.()
    return { status: response.status, body: await response.json().catch(() => null) }
  }

  const call = async (method: string, args: unknown[]): Promise<unknown> => {
    const { status, body } = await request(`/${method}`, {
      method: 'POST',
      body: JSON.stringify({ args: trimTrailingUndefined(args) })
    })
    if (!isIpcResult(body)) {
      throw new RemoteError('BAD_RESPONSE', `DevHub 返回了无效的响应（${status}）`, status)
    }
    if (body.ok) return body.value
    throw new RemoteError(body.error.code, body.error.message, status)
  }

  const api = Object.fromEntries(
    devhubApiMethods.map((method) => [method, (...args: unknown[]) => call(method, args)])
  ) as unknown as DevhubApi

  return {
    api,
    events: createEventStream(options, () => url('/events'), auth),
    async session() {
      const { status, body } = await request('/session', { method: 'GET' })
      if (status === 200 && isSession(body)) return body
      if (isIpcResult(body) && !body.ok) {
        throw new RemoteError(body.error.code, body.error.message, status)
      }
      throw new RemoteError('BAD_RESPONSE', `DevHub 返回了无效的响应（${status}）`, status)
    }
  }
}

function createEventStream(
  options: RemoteClientOptions,
  streamUrl: () => string,
  auth: () => Record<string, string>
): RemoteEvents {
  const retryDelays = options.retryDelaysMs ?? [1000, 2000, 5000, 10_000]
  const listeners = new Set<(event: DevhubEvent) => void>()
  const readyListeners = new Set<() => void>()
  let running = false
  let reader: StreamReader | null = null

  /** One connection shared by every subscriber, kept open while anyone listens. */
  const connect = async (): Promise<void> => {
    let attempt = 0
    while (listeners.size > 0) {
      try {
        const response = await options.fetch(streamUrl(), { method: 'GET', headers: auth() })
        if (response.status === 401) {
          options.onUnauthorized?.()
          break
        }
        if (response.status !== 200 || !response.body) throw new Error(`status ${response.status}`)
        reader = response.body.getReader()
        const decode = options.createDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done || !value) break
          const parsed = parseSse(buffer + decode(value))
          buffer = parsed.rest
          for (const message of parsed.messages) {
            if (message.event === 'ready') {
              attempt = 0
              readyListeners.forEach((listener) => listener())
            } else if (message.event === 'message') {
              const event = parseJson(message.data) as DevhubEvent | undefined
              if (event) listeners.forEach((listener) => listener(event))
            }
          }
        }
      } catch {
        // Network failure or server restart: retry below.
      }
      reader = null
      if (listeners.size === 0) break
      await options.delay(retryDelays[Math.min(attempt++, retryDelays.length - 1)] ?? 10_000)
    }
    running = false
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (!running) {
        running = true
        void connect()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) void reader?.cancel().catch(() => undefined)
      }
    },
    onReady(listener) {
      readyListeners.add(listener)
      return () => readyListeners.delete(listener)
    }
  }
}

export interface SseMessage {
  /** `message` when the server named no event type. */
  event: string
  data: string
}

/** Splits complete Server-Sent Events off the front of `text`; `rest` is an unfinished message. */
export function parseSse(text: string): { messages: SseMessage[]; rest: string } {
  const normalized = text.replace(/\r\n?/g, '\n')
  const blocks = normalized.split('\n\n')
  const rest = blocks.pop() ?? ''
  const messages: SseMessage[] = []
  for (const block of blocks) {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line === '' || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (data.length > 0) messages.push({ event, data: data.join('\n') })
  }
  return { messages, rest }
}

/** JSON turns `undefined` into `null`; dropping trailing ones keeps optional arguments omitted. */
function trimTrailingUndefined(args: unknown[]): unknown[] {
  let end = args.length
  while (end > 0 && args[end - 1] === undefined) end--
  return args.slice(0, end)
}

function isIpcResult(value: unknown): value is IpcResult<unknown> {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  if (value.ok === true) return true
  const error = (value as { error?: unknown }).error
  return (
    value.ok === false &&
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

function isSession(value: unknown): value is RemoteSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RemoteSession).protocol === 'number' &&
    typeof (value as RemoteSession).allowTerminal === 'boolean' &&
    ['string', 'undefined'].includes(typeof (value as RemoteSession).appVersion)
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
