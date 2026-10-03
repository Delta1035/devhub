import { describe, expect, it } from 'vitest'
import { stripAnsi } from './text'

describe('plain-text terminal output', () => {
  it('removes ANSI colors, title and cursor commands while retaining text', () => {
    expect(stripAnsi('\u001b]0;title\u0007\u001b[32m中文🙂\u001b[0m\nnext\u001b[2K')).toBe(
      '中文🙂\nnext'
    )
    expect(stripAnsi('<script>alert(1)</script>')).toBe('<script>alert(1)</script>')
  })
})
