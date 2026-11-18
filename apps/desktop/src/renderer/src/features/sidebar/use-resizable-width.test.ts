import { describe, expect, it } from 'vitest'
import { clampWidth } from './use-resizable-width'

describe('clampWidth', () => {
  it('clamps values below minWidth', () => {
    expect(clampWidth(100, 200, 1024)).toBe(200)
    expect(clampWidth(0, 200, 1024)).toBe(200)
    expect(clampWidth(-50, 200, 1024)).toBe(200)
  })

  it('clamps values exceeding available window space', () => {
    // 1024 - 480 = 544
    expect(clampWidth(600, 200, 1024)).toBe(544)
    expect(clampWidth(1000, 200, 1024)).toBe(544)
  })

  it('keeps valid values within range', () => {
    expect(clampWidth(256, 200, 1024)).toBe(256)
    expect(clampWidth(320, 200, 1024)).toBe(320)
  })

  it('rounds float widths to integer', () => {
    expect(clampWidth(256.4, 200, 1024)).toBe(256)
    expect(clampWidth(256.7, 200, 1024)).toBe(257)
  })

  it('respects minWidth even when window is very small', () => {
    // Window width 500, 500 - 480 = 20, minWidth = 200
    // Math.max(minWidth, windowWidth - reserve) => Math.max(200, 20) = 200
    expect(clampWidth(150, 200, 500)).toBe(200)
    expect(clampWidth(250, 200, 500)).toBe(200)
  })
})
