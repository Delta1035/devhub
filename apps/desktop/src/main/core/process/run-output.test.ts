import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OutputCursor } from '@devhub/shared'
import { RunOutput } from './run-output'

describe('RunOutput', () => {
  let flushed: [offset: number, data: string][]

  beforeEach(() => {
    vi.useFakeTimers()
    flushed = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeOutput = (limit = 100) =>
    new RunOutput({ limit, flushMs: 16, onFlush: (offset, data) => flushed.push([offset, data]) })

  it('coalesces chunks within the flush window', async () => {
    const output = makeOutput()
    output.append('a')
    output.append('b')
    expect(flushed).toEqual([])
    await vi.advanceTimersByTimeAsync(16)
    expect(flushed).toEqual([[0, 'ab']])

    output.append('c')
    await vi.advanceTimersByTimeAsync(16)
    expect(flushed).toEqual([
      [0, 'ab'],
      [2, 'c']
    ])
  })

  it('flushes immediately on demand and does not flush twice', async () => {
    const output = makeOutput()
    output.append('bye')
    output.flush()
    await vi.advanceTimersByTimeAsync(100)
    expect(flushed).toEqual([[0, 'bye']])
  })

  it('ignores empty chunks', async () => {
    const output = makeOutput()
    output.append('')
    await vi.advanceTimersByTimeAsync(100)
    expect(flushed).toEqual([])
    expect(output.snapshot()).toEqual({ data: '', end: 0 })
  })

  it('caps the snapshot buffer but keeps counting stream positions', () => {
    const output = makeOutput(4)
    output.append('hello')
    output.append('world')
    expect(output.snapshot()).toEqual({ data: 'orld', end: 10 })
  })

  it('stitches with OutputCursor into the exact stream, with no gaps or duplicates', async () => {
    const output = makeOutput()
    output.append('one ')
    await vi.advanceTimersByTimeAsync(16)
    output.append('two ')
    // A client subscribes now: it missed "one " live, and "two " is still pending.
    const cursor = new OutputCursor()
    let screen = cursor.acceptSnapshot(output.snapshot())
    output.append('three')
    await vi.advanceTimersByTimeAsync(16)
    for (const [offset, data] of flushed) screen += cursor.accept(offset, data)
    expect(screen).toBe('one two three')
  })
})
