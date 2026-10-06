import { connect } from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import type { DevhubApi, DevhubEvent } from '@devhub/shared'
import { startRemoteServer, type RemoteServer, type RemoteServerOptions } from './remote-server'

const token = 'x'.repeat(43)

type DevhubEventListener = (event: DevhubEvent) => void

/** Minimal event bus that exposes how many clients are subscribed. */
function createBus(): { listeners: Set<DevhubEventListener>; emit(event: DevhubEvent): void } {
  const listeners = new Set<DevhubEventListener>()
  return {
    listeners,
    emit: (event) => listeners.forEach((listener) => listener(event))
  }
}

const removed = (runId: string): DevhubEvent => ({ type: 'run-removed', runId })

async function readUntil(
  response: Response,
  done: (text: string) => boolean,
  timeoutMs = 2000
): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let text = ''
  const deadline = Date.now() + timeoutMs
  while (!done(text)) {
    if (Date.now() > deadline) throw new Error(`timed out; got ${JSON.stringify(text)}`)
    const { value, done: ended } = await reader.read()
    if (ended) break
    text += decoder.decode(value, { stream: true })
  }
  reader.releaseLock()
  return text
}

const until = async (condition: () => boolean, timeoutMs = 2000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not met in time')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('remote event stream', () => {
  let server: RemoteServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  const start = async (
    bus: ReturnType<typeof createBus>,
    options: Partial<RemoteServerOptions> = {}
  ): Promise<string> => {
    server = await startRemoteServer({
      api: {} as DevhubApi,
      subscribe: (listener) => {
        bus.listeners.add(listener)
        return () => bus.listeners.delete(listener)
      },
      host: '127.0.0.1',
      port: 0,
      token,
      allowTerminal: false,
      ...options
    })
    return `http://127.0.0.1:${server.port}/api/v1/events`
  }

  const open = (url: string, signal?: AbortSignal): Promise<Response> =>
    fetch(url, { headers: { authorization: `Bearer ${token}` }, signal })

  it('needs the token and GET', async () => {
    const bus = createBus()
    const url = await start(bus)
    expect((await fetch(url)).status).toBe(401)
    expect((await fetch(url, { method: 'POST' })).status).toBe(405)
    expect(bus.listeners.size).toBe(0)
  })

  it('signals ready, then streams each core event as JSON in order', async () => {
    const bus = createBus()
    const response = await open(await start(bus))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    // Keeps proxies such as `tailscale serve` or nginx from buffering or rewriting events.
    expect(response.headers.get('cache-control')).toContain('no-transform')
    expect(response.headers.get('x-accel-buffering')).toBe('no')

    const ready = await readUntil(response, (text) => text.includes('\n\n'))
    expect(ready).toBe('event: ready\ndata: {"protocol":1}\n\n')

    bus.emit(removed('a'))
    bus.emit(removed('b'))
    const text = await readUntil(response, (value) => value.split('\n\n').length > 2)
    expect(text).toBe(
      'data: {"type":"run-removed","runId":"a"}\n\ndata: {"type":"run-removed","runId":"b"}\n\n'
    )
  })

  it('sends heartbeats while idle', async () => {
    const bus = createBus()
    const response = await open(await start(bus, { heartbeatMs: 20 }))
    const text = await readUntil(response, (value) => value.includes(': ping\n\n'))
    expect(text).toContain(': ping\n\n')
  })

  it('unsubscribes when the client goes away', async () => {
    const bus = createBus()
    const controller = new AbortController()
    const response = await open(await start(bus), controller.signal)
    await readUntil(response, (text) => text.includes('ready'))
    expect(bus.listeners.size).toBe(1)
    controller.abort()
    await until(() => bus.listeners.size === 0)
  })

  it('drops a client that stops reading once it falls too far behind', async () => {
    const bus = createBus()
    const url = new URL(await start(bus, { maxBufferedBytes: 64 * 1024 }))
    // A raw socket that never reads, so the server's buffer can only grow.
    const socket = connect(Number(url.port), url.hostname)
    socket.pause()
    socket.write(
      `GET ${url.pathname} HTTP/1.1\r\nHost: ${url.host}\r\nAuthorization: Bearer ${token}\r\n\r\n`
    )
    await until(() => bus.listeners.size === 1)

    const chunk = removed('r'.repeat(64 * 1024))
    for (let i = 0; i < 2000 && bus.listeners.size > 0; i++) {
      bus.emit(chunk)
      await new Promise((resolve) => setImmediate(resolve))
    }
    expect(bus.listeners.size).toBe(0)
    socket.destroy()
  })

  it('ends open streams when the server closes', async () => {
    const bus = createBus()
    const response = await open(await start(bus))
    await readUntil(response, (text) => text.includes('ready'))
    const reading = readUntil(response, () => false).catch(() => 'ended')
    await server!.close()
    server = undefined
    await expect(reading).resolves.toBeDefined()
    expect(bus.listeners.size).toBe(0)
  })
})
