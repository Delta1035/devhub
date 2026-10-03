import { describe, expect, it } from 'vitest'
import { runHistoryOutputLimit } from '@devhub/shared'
import { HistoryOutput } from './history-output'

describe('HistoryOutput', () => {
  it('keeps ordered chunks and exactly the configured byte limit', () => {
    const buffer = new HistoryOutput(8)
    buffer.append('1234')
    buffer.append('5678')
    expect(buffer.snapshot()).toEqual({ data: '12345678', truncated: false })
    buffer.append('9')
    expect(buffer.snapshot()).toEqual({ data: '23456789', truncated: true })
  })
  it('trims without producing replacement characters for Chinese or emoji', () => {
    const buffer = new HistoryOutput(8)
    buffer.append('头中文🙂')
    expect(buffer.snapshot()).toEqual({ data: '文🙂', truncated: true })
    buffer.append('好')
    expect(buffer.snapshot()).toEqual({ data: '🙂好', truncated: true })
    expect(Buffer.byteLength(buffer.snapshot().data)).toBeLessThanOrEqual(8)
  })
  it('caps a large chunk to 512 KB while preserving its final marker', () => {
    const buffer = new HistoryOutput()
    buffer.append('x'.repeat(runHistoryOutputLimit * 2) + 'END')
    expect(Buffer.byteLength(buffer.snapshot().data)).toBe(runHistoryOutputLimit)
    expect(buffer.snapshot().data.endsWith('END')).toBe(true)
    expect(buffer.snapshot().truncated).toBe(true)
  })
})
