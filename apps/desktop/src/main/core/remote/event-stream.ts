import type { ServerResponse } from 'http'
import { remoteProtocolVersion, type DevhubEvents } from '@devhub/shared'

export interface EventStreamOptions {
  subscribe: DevhubEvents['subscribe']
  /** Comment lines keep proxies and NAT from dropping an idle stream. */
  heartbeatMs?: number
  /** A client this far behind is dropped; it reconnects and catches up (ADR 0022). */
  maxBufferedBytes?: number
}

/**
 * Streams core events as Server-Sent Events: one `data: <json>` per `DevhubEvent`.
 * A first `ready` event tells the client it is subscribed, so a snapshot fetched after it
 * (`getRunOutput`) cannot miss output. There is no replay: after a reconnect the client
 * fetches state again and stitches output with `OutputCursor`.
 */
export function openEventStream(
  response: ServerResponse,
  { subscribe, heartbeatMs = 15_000, maxBufferedBytes = 4 * 1024 * 1024 }: EventStreamOptions,
  onClose: () => void = () => undefined
): { end(): void } {
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-store',
    'x-accel-buffering': 'no',
    'x-content-type-options': 'nosniff'
  })

  let open = true
  let unsubscribe = (): void => undefined
  // The callback only runs after `write` below is defined.
  const heartbeat = setInterval(() => write(': ping\n\n'), heartbeatMs)
  const close = (): void => {
    if (!open) return
    open = false
    clearInterval(heartbeat)
    unsubscribe()
    onClose()
  }
  const write = (chunk: string): void => {
    if (!open) return
    response.write(chunk)
    if (response.writableLength > maxBufferedBytes) {
      close()
      response.destroy()
    }
  }
  response.once('close', close)

  unsubscribe = subscribe((event) => write(`data: ${JSON.stringify(event)}\n\n`))
  write(`event: ready\ndata: ${JSON.stringify({ protocol: remoteProtocolVersion })}\n\n`)

  return {
    /** Unsubscribes at once and ends the response (server shutdown). */
    end() {
      close()
      response.end()
    }
  }
}
