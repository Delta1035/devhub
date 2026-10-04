import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { isWithin, samePath } from './path-compare'

const root = resolve('/work/code')

describe('path comparison', () => {
  it('ignores case only on Windows', () => {
    expect(samePath(root, root.toUpperCase(), 'win32')).toBe(true)
    expect(samePath(root, root.toUpperCase(), 'linux')).toBe(false)
  })

  it('treats the directory itself and its descendants as within it', () => {
    expect(isWithin(root, root, 'linux')).toBe(true)
    expect(isWithin(join(root, 'a', 'b'), root, 'linux')).toBe(true)
    expect(isWithin(join(root, 'A'), root.toUpperCase(), 'win32')).toBe(true)
  })

  it('does not treat siblings sharing a name prefix or parents as within it', () => {
    expect(isWithin(resolve('/work/code-old'), root, 'linux')).toBe(false)
    expect(isWithin(resolve('/work'), root, 'linux')).toBe(false)
    expect(isWithin(resolve('/other'), root, 'linux')).toBe(false)
  })

  it('keeps children whose name starts with two dots inside', () => {
    expect(isWithin(join(root, '..cache'), root, 'linux')).toBe(true)
  })
})
