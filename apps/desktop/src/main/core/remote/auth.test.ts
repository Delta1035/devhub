import { describe, expect, it } from 'vitest'
import { bearerToken, createFailureLimiter, generateToken, tokensEqual } from './auth'

describe('remote auth', () => {
  it('generates distinct URL-safe tokens', () => {
    const a = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateToken()).not.toBe(a)
  })

  it('compares tokens of any length', () => {
    expect(tokensEqual('secret', 'secret')).toBe(true)
    expect(tokensEqual('secret', 'secreT')).toBe(false)
    expect(tokensEqual('', 'secret')).toBe(false)
    expect(tokensEqual('secret-and-more', 'secret')).toBe(false)
  })

  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', null],
    ['Bearer', null],
    ['Bearer a b', null],
    ['Basic abc', null],
    [undefined, null]
  ])('reads the token from %o', (header, expected) => {
    expect(bearerToken(header)).toBe(expected)
  })

  it('blocks an address after too many failures until the window passes', () => {
    let time = 0
    const limiter = createFailureLimiter({ maxFailures: 3, windowMs: 1000, now: () => time })
    for (let i = 0; i < 3; i++) {
      expect(limiter.isBlocked('a')).toBe(false)
      limiter.recordFailure('a')
    }
    expect(limiter.isBlocked('a')).toBe(true)
    expect(limiter.isBlocked('b')).toBe(false)
    time = 1000
    expect(limiter.isBlocked('a')).toBe(false)
  })
})
