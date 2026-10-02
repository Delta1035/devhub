import { describe, expect, it } from 'vitest'
import { joinArgs, splitArgs } from './args'

describe('splitArgs', () => {
  it.each([
    ['', []],
    ['  ', []],
    ['-NoLogo', ['-NoLogo']],
    ['--login  -i', ['--login', '-i']],
    ['--rcfile "C:\\My Files\\rc" -i', ['--rcfile', 'C:\\My Files\\rc', '-i']],
    ['-c ""', ['-c', '']],
    ['a"b c"d', ['ab cd']]
  ])('%j', (input, expected) => {
    expect(splitArgs(input)).toEqual(expected)
  })
})

describe('joinArgs', () => {
  it('quotes only what needs it, and round-trips with splitArgs', () => {
    const args = ['--rcfile', 'C:\\My Files\\rc', '-i', '']
    const joined = joinArgs(args)
    expect(joined).toBe('--rcfile "C:\\My Files\\rc" -i ""')
    expect(splitArgs(joined)).toEqual(args)
  })
})
