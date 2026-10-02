import { describe, expect, it } from 'vitest'
import { stripAnsi } from './ansi'

describe('stripAnsi', () => {
  it('removes colors, cursor moves and window titles', () => {
    expect(stripAnsi('\x1b[1;32mok\x1b[0m \x1b[2K\x1b[1Gline \x1b]0;title\x07done')).toBe(
      'ok line done'
    )
  })
})
