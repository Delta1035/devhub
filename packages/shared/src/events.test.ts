import { describe, expect, it } from 'vitest'
import { OutputCursor } from './events'

describe('OutputCursor', () => {
  it('passes through contiguous chunks', () => {
    const cursor = new OutputCursor()
    expect(cursor.accept(0, 'hello ')).toBe('hello ')
    expect(cursor.accept(6, 'world')).toBe('world')
  })

  it('drops chunks already covered by the snapshot', () => {
    const cursor = new OutputCursor()
    expect(cursor.acceptSnapshot({ data: 'hello world', end: 11 })).toBe('hello world')
    expect(cursor.accept(0, 'hello ')).toBe('')
    expect(cursor.accept(6, 'world')).toBe('')
  })

  it('keeps only the unseen tail of a chunk overlapping the snapshot', () => {
    const cursor = new OutputCursor()
    cursor.acceptSnapshot({ data: 'hello wo', end: 8 })
    expect(cursor.accept(6, 'world!')).toBe('rld!')
    expect(cursor.accept(12, '\n')).toBe('\n')
  })

  it('handles a snapshot whose start was truncated by the buffer cap', () => {
    const cursor = new OutputCursor()
    expect(cursor.acceptSnapshot({ data: 'tail', end: 1000 })).toBe('tail')
    expect(cursor.accept(998, 'il+more')).toBe('+more')
  })

  it('accepts a chunk after a gap as-is', () => {
    const cursor = new OutputCursor()
    cursor.accept(0, 'abc')
    expect(cursor.accept(10, 'xyz')).toBe('xyz')
    expect(cursor.accept(12, 'z!')).toBe('!')
  })

  it('handles an empty snapshot', () => {
    const cursor = new OutputCursor()
    expect(cursor.acceptSnapshot({ data: '', end: 0 })).toBe('')
    expect(cursor.accept(0, 'first')).toBe('first')
  })
})
