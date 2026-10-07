import { describe, expect, it, vi } from 'vitest'
import type { DevhubEvent } from './events'
import {
  createRemoteClient,
  parseSse,
  RemoteError,
  type FetchFn,
  type FetchResponse,
  type RemoteClientOptions,
  type StreamReader
} from './remote-client'

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0))
const asciiDecoder = () => (chunk: Uint8Array) => String.fromCharCode(...chunk)

const json = (status: number, body: unknown): FetchResponse => ({
  status,
  json: async () => body,
  body: null
})

/** A response whose body yields the given chunks, then stays open until cancelled. */
function stream(
  chunks: string[],
  { endAfter = false } = {}
): FetchResponse & { cancelled: boolean } {
  const queue = [...chunks]
  let release: (() => void) | undefined
  const response = {
    status: 200,
    cancelled: false,
    json: async () => null,
    body: {
      getReader: (): StreamReader => ({
        read: async () => {
          const next = queue.shift()
          if (next !== undefined) return { done: false, value: ascii(next) }
          if (endAfter || response.cancelled) return { done: true }
          await new Promise<void>((resolve) => (release = resolve))
          return { done: true }
        },
        cancel: async () => {
          response.cancelled = true
          release?.()
        }
      })
    }
  }
  return response
}

const client = (fetch: FetchFn, overrides: Partial<RemoteClientOptions> = {}) =>
  createRemoteClient({
    baseUrl: 'http://host:7420',
    token: () => 'secret',
    fetch,
    createDecoder: asciiDecoder,
    delay: async () => undefined,
    ...overrides
  })

/** Lets pending promise chains run (this package has no timer typings). */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('parseSse', () => {
  it('splits complete messages and keeps the unfinished rest', () => {
    expect(
      parseSse('event: ready\ndata: {"protocol":1}\n\n: ping\n\ndata: a\ndata: b\n\ndata: par')
    ).toEqual({
      messages: [
        { event: 'ready', data: '{"protocol":1}' },
        { event: 'message', data: 'a\nb' }
      ],
      rest: 'data: par'
    })
  })

  it('accepts CRLF line endings', () => {
    expect(parseSse('data: x\r\n\r\n').messages).toEqual([{ event: 'message', data: 'x' }])
  })
})

describe('remote api', () => {
  it('posts the arguments with the token and returns the value', async () => {
    const fetch = vi.fn<FetchFn>(async () => json(200, { ok: true, value: ['p'] }))
    await expect(client(fetch).api.listScripts('p1')).resolves.toEqual(['p'])
    expect(fetch).toHaveBeenCalledWith('http://host:7420/api/v1/listScripts', {
      method: 'POST',
      headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
      body: '{"args":["p1"]}'
    })
  })

  it('reads a base URL function on every request', async () => {
    const fetch = vi.fn<FetchFn>(async () => json(200, { ok: true, value: [] }))
    let base = 'http://a:7420'
    const api = client(fetch, { baseUrl: () => base }).api
    await api.listProjects()
    base = 'http://b:7420'
    await api.listProjects()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://a:7420/api/v1/listProjects',
      'http://b:7420/api/v1/listProjects'
    ])
  })

  it('leaves out trailing undefined arguments, as JSON would turn them into null', async () => {
    const fetch = vi.fn<FetchFn>(async () => json(200, { ok: true, value: {} }))
    await client(fetch).api.startScript('p', 's', undefined)
    expect(fetch.mock.calls[0]![1].body).toBe('{"args":["p","s"]}')
  })

  it('throws the core error with its code and message', async () => {
    const fetch: FetchFn = async () =>
      json(200, { ok: false, error: { code: 'RUN_NOT_FOUND', message: '运行不存在' } })
    const failure = await client(fetch)
      .api.stopRun('r')
      .catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(RemoteError)
    expect(failure).toMatchObject({ code: 'RUN_NOT_FOUND', message: '运行不存在', status: 200 })
  })

  it('reports a rejected token', async () => {
    const onUnauthorized = vi.fn()
    const fetch: FetchFn = async () =>
      json(401, { ok: false, error: { code: 'UNAUTHORIZED', message: '访问令牌无效' } })
    await expect(client(fetch, { onUnauthorized }).api.listRuns()).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    })
    expect(onUnauthorized).toHaveBeenCalled()
  })

  it('turns network failures and garbage into readable errors', async () => {
    await expect(
      client(async () => {
        throw new TypeError('Failed to fetch')
      }).api.listRuns()
    ).rejects.toMatchObject({ code: 'NETWORK' })
    await expect(client(async () => json(502, '<html>')).api.listRuns()).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
      status: 502
    })
  })

  it('reads the session', async () => {
    const fetch = vi.fn<FetchFn>(async () => json(200, { protocol: 1, allowTerminal: false }))
    await expect(client(fetch).session()).resolves.toEqual({ protocol: 1, allowTerminal: false })
    expect(fetch).toHaveBeenCalledWith('http://host:7420/api/v1/session', {
      method: 'GET',
      headers: { authorization: 'Bearer secret' }
    })
  })
})

describe('remote events', () => {
  const event: DevhubEvent = { type: 'run-removed', runId: 'r1' }

  it('delivers events to every subscriber and signals ready', async () => {
    const body = stream([
      'event: ready\ndata: {"protocol":1}\n\n',
      `data: ${JSON.stringify(event).slice(0, 10)}`,
      `${JSON.stringify(event).slice(10)}\n\n`
    ])
    const fetch = vi.fn<FetchFn>(async () => body)
    const { events } = client(fetch)
    const ready = vi.fn()
    events.onReady(ready)
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = events.subscribe(first)
    events.subscribe(second)
    await vi.waitFor(() => expect(second).toHaveBeenCalledWith(event))
    expect(first).toHaveBeenCalledWith(event)
    expect(ready).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    stopFirst()
    expect(body.cancelled).toBe(false)
  })

  it('closes the stream once nobody listens', async () => {
    const body = stream(['event: ready\ndata: {}\n\n'])
    const { events } = client(async () => body)
    const stop = events.subscribe(() => undefined)
    await flush()
    stop()
    await vi.waitFor(() => expect(body.cancelled).toBe(true))
  })

  it('reconnects after the stream ends and signals ready again', async () => {
    const delay = vi.fn(async () => undefined)
    const responses = [
      stream(['event: ready\ndata: {}\n\n'], { endAfter: true }),
      stream(['event: ready\ndata: {}\n\n', `data: ${JSON.stringify(event)}\n\n`])
    ]
    const fetch = vi.fn<FetchFn>(async () => responses.shift() ?? json(500, null))
    const { events } = client(fetch, { delay, retryDelaysMs: [5] })
    const ready = vi.fn()
    events.onReady(ready)
    const listener = vi.fn()
    const stop = events.subscribe(listener)
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(event))
    expect(ready).toHaveBeenCalledTimes(2)
    expect(delay).toHaveBeenCalledWith(5)
    stop()
  })

  it('stops and reports when the token is rejected', async () => {
    const onUnauthorized = vi.fn()
    const fetch = vi.fn<FetchFn>(async () => json(401, null))
    client(fetch, { onUnauthorized }).events.subscribe(() => undefined)
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalled())
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
