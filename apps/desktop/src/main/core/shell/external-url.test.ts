import { describe, expect, it } from 'vitest'
import { parseExternalUrl } from './external-url'

describe('parseExternalUrl', () => {
  it.each([
    ['http://localhost:5173', 'http://localhost:5173/'],
    ['https://example.com/docs?q=1#top', 'https://example.com/docs?q=1#top'],
    ['http://127.0.0.1:8080/api', 'http://127.0.0.1:8080/api'],
    ['  https://example.com  ', 'https://example.com/'],
    ['HTTPS://EXAMPLE.COM', 'https://example.com/']
  ])('accepts %s', (input, expected) => {
    expect(parseExternalUrl(input)).toBe(expected)
  })

  it.each([
    ['file:///C:/Windows/System32/calc.exe'],
    ['javascript:alert(1)'],
    ['ftp://example.com'],
    ['ms-settings:privacy'],
    ['/relative/path'],
    ['localhost:5173'],
    [''],
    [42],
    [null],
    [`https://example.com/${'a'.repeat(2048)}`]
  ])('rejects %s', (input) => {
    expect(() => parseExternalUrl(input)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' })
    )
  })
})
