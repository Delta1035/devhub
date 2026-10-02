import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { answerBatchPrompt } from './batch-prompt'

describe('answerBatchPrompt', () => {
  let output: string
  let written: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    output = 'server running\r\n'
    written = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const watch = () =>
    answerBatchPrompt(
      () => ({ data: output, end: output.length }),
      (data) => written.push(data)
    )

  it.each([
    ['English', '^C\r\nTerminate batch job (Y/N)? '],
    ['Chinese', '^C\r\n终止批处理操作吗(Y/N)? '],
    ['with color codes', '^C\r\n\x1b[0mTerminate batch job (Y/N)?\x1b[?25h ']
  ])('answers the %s prompt once', async (_label, prompt) => {
    watch()
    output += prompt
    await vi.advanceTimersByTimeAsync(300)
    expect(written).toEqual(['Y\r'])
  })

  it('ignores a "(Y/N)?" the program printed before the interrupt', async () => {
    output += 'Overwrite existing file? (Y/N)? '
    watch()
    await vi.advanceTimersByTimeAsync(300)
    expect(written).toEqual([])
  })

  it('does nothing when no prompt appears, and stops when asked', async () => {
    const stop = watch()
    output += '^C\r\nbye\r\n'
    await vi.advanceTimersByTimeAsync(300)
    stop()
    output += 'Terminate batch job (Y/N)? '
    await vi.advanceTimersByTimeAsync(300)
    expect(written).toEqual([])
  })

  it('keeps working when the buffer was trimmed by its size cap', async () => {
    // Snapshot data shorter than the stream: only the tail is kept.
    const from = 10_000
    let end = from
    let data = 'old output'
    answerBatchPrompt(
      () => ({ data, end }),
      (chunk) => written.push(chunk)
    )
    data = 'kept tail ... Terminate batch job (Y/N)? '
    end = from + 40
    await vi.advanceTimersByTimeAsync(100)
    expect(written).toEqual(['Y\r'])
  })
})
