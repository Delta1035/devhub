import { describe, expect, it } from 'vitest'
import { createChunkDecoder } from './utf8-chunks'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const decodeWhole = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

describe('createChunkDecoder', () => {
  it('holds back a character split at any byte', () => {
    const bytes = encode('启动 ok 😀!')
    for (let split = 0; split <= bytes.length; split++) {
      const decode = createChunkDecoder(decodeWhole)
      const text = decode(bytes.subarray(0, split)) + decode(bytes.subarray(split))
      expect(text).toBe('启动 ok 😀!')
    }
  })

  it('handles one byte at a time', () => {
    const decode = createChunkDecoder(decodeWhole)
    const text = Array.from(encode('日志 log')).reduce(
      (out, byte) => out + decode(Uint8Array.of(byte)),
      ''
    )
    expect(text).toBe('日志 log')
  })

  it('does not call the decoder for an incomplete character alone', () => {
    let calls = 0
    const decode = createChunkDecoder((bytes) => {
      calls++
      return decodeWhole(bytes)
    })
    expect(decode(encode('中').subarray(0, 2))).toBe('')
    expect(calls).toBe(0)
  })
})
