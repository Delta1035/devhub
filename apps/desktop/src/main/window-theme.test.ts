import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { applyWindowThemeIcon } from './window-theme'

describe('applyWindowThemeIcon', () => {
  it('updates window icon when not destroyed', () => {
    const setIcon = vi.fn()
    const mockWindow = {
      isDestroyed: () => false,
      setIcon
    } as unknown as BrowserWindow

    applyWindowThemeIcon(mockWindow, 'light')
    expect(setIcon).toHaveBeenCalled()
    const lightCall = setIcon.mock.calls[0]

    applyWindowThemeIcon(mockWindow, 'dark')
    expect(setIcon).toHaveBeenCalledTimes(2)
    const darkCall = setIcon.mock.calls[1]
    expect(lightCall).not.toEqual(darkCall)
  })

  it('ignores destroyed window', () => {
    const setIcon = vi.fn()
    const mockWindow = {
      isDestroyed: () => true,
      setIcon
    } as unknown as BrowserWindow

    applyWindowThemeIcon(mockWindow, 'light')
    expect(setIcon).not.toHaveBeenCalled()
  })
})
