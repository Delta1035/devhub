import { useEffect, useState } from 'react'
import { OutputCursor } from '@devhub/shared'
import { useDevhub } from '@/api'
import { LogText } from './log-text'

/**
 * The run's output as plain text, live. Subscribes before taking the snapshot and stitches both
 * with `OutputCursor`, as the desktop terminal does, so nothing is lost or repeated.
 */
export function useRunLog(runId: string): { text: string; error: string | null } {
  const { api, events } = useDevhub()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cursor = new OutputCursor()
    const log = new LogText()
    let frame: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    const write = (data: string): void => {
      if (!data || cancelled) return
      log.append(data)
      // Output arrives every 16 ms while busy: re-render at most ~10 times a second.
      frame ??= setTimeout(() => {
        frame = null
        setText(log.text)
      }, 100)
    }

    // Live chunks are held until the snapshot arrives; the cursor drops what it already had.
    let held: { offset: number; data: string }[] | null = []
    const unsubscribe = events.subscribe((event) => {
      if (event.type !== 'run-output' || event.runId !== runId) return
      if (held) held.push(event)
      else write(cursor.accept(event.offset, event.data))
    })
    api
      .getRunOutput(runId)
      .then(
        (snapshot) => write(cursor.acceptSnapshot(snapshot)),
        (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))
      )
      .finally(() => {
        if (cancelled) return
        const chunks = held ?? []
        held = null
        for (const chunk of chunks) write(cursor.accept(chunk.offset, chunk.data))
      })
    return () => {
      cancelled = true
      unsubscribe()
      if (frame) clearTimeout(frame)
    }
  }, [api, events, runId])

  return { text, error }
}
