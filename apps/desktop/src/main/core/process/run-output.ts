import type { RunOutputSnapshot } from '@devhub/shared'

export interface RunOutputOptions {
  /** Characters kept for snapshots; older output is dropped. */
  limit: number
  /** Chunks arriving within this window are coalesced into one flush. */
  flushMs: number
  /** Receives coalesced output with its offset in the run's whole output stream. */
  onFlush: (offset: number, data: string) => void
}

/**
 * Output of one run: a capped buffer for snapshots plus coalesced live chunks.
 * Coalescing keeps chatty processes (progress bars) from flooding IPC / the remote event stream.
 */
export class RunOutput {
  private buffer = ''
  /** Total characters ever received = stream position after the last chunk. */
  private end = 0
  private pending = ''
  private pendingOffset = 0
  private timer: NodeJS.Timeout | undefined

  constructor(private readonly options: RunOutputOptions) {}

  append(data: string): void {
    if (data.length === 0) return
    if (this.pending.length === 0) this.pendingOffset = this.end
    this.pending += data
    this.end += data.length
    this.buffer += data
    if (this.buffer.length > this.options.limit)
      this.buffer = this.buffer.slice(-this.options.limit)
    this.timer ??= setTimeout(() => this.flush(), this.options.flushMs)
  }

  /** Emits pending output now, e.g. before announcing that the run exited. */
  flush(): void {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.pending.length === 0) return
    const data = this.pending
    this.pending = ''
    this.options.onFlush(this.pendingOffset, data)
  }

  /** Includes output not flushed yet; the cursor on the client drops the overlap. */
  snapshot(): RunOutputSnapshot {
    return { data: this.buffer, end: this.end }
  }
}
