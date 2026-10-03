import { runHistoryOutputLimit, type RunHistoryOutput } from '@devhub/shared'

/** Retains a UTF-8 tail without splitting a multibyte character. */
export class HistoryOutput {
  private data = Buffer.alloc(0)
  private truncated = false

  constructor(private readonly limit = runHistoryOutputLimit) {}

  append(text: string): void {
    const combined = Buffer.concat([this.data, Buffer.from(text, 'utf8')])
    let start = Math.max(0, combined.length - this.limit)
    if (start > 0) {
      this.truncated = true
      while (start < combined.length && (combined[start]! & 0xc0) === 0x80) start++
    }
    // Copy a trimmed tail so a large chunk's backing allocation is not retained.
    this.data = start > 0 ? Buffer.from(combined.subarray(start)) : combined
  }

  snapshot(): RunHistoryOutput {
    return { data: this.data.toString('utf8'), truncated: this.truncated }
  }
}
