import { describe, expect, it, vi } from 'vitest'
import { updateDesktopShortcutStyle, type DesktopShortcutDeps } from './desktop-shortcut'

describe('updateDesktopShortcutStyle', () => {
  it('returns failure on non-Windows platforms', async () => {
    const deps: DesktopShortcutDeps = {
      platform: 'linux',
      env: {},
      exists: vi.fn(),
      resolveIconPath: vi.fn(),
      updateShortcut: vi.fn()
    }

    const result = await updateDesktopShortcutStyle('light', deps)
    expect(result.success).toBe(false)
    expect(result.message).toContain('仅支持 Windows')
  })

  it('fails when icon file does not exist', async () => {
    const deps: DesktopShortcutDeps = {
      platform: 'win32',
      env: { USERPROFILE: 'C:\\Users\\tester' },
      exists: vi.fn().mockResolvedValue(false),
      resolveIconPath: vi.fn().mockResolvedValue('C:\\resources\\icon-light.ico'),
      updateShortcut: vi.fn()
    }

    const result = await updateDesktopShortcutStyle('light', deps)
    expect(result.success).toBe(false)
    expect(result.message).toContain('未找到浅色图标文件')
  })

  it('fails when no DevHub shortcut exists', async () => {
    const deps: DesktopShortcutDeps = {
      platform: 'win32',
      env: { USERPROFILE: 'C:\\Users\\tester' },
      exists: vi.fn((path: string) => Promise.resolve(path.endsWith('.ico'))),
      resolveIconPath: vi.fn().mockResolvedValue('C:\\resources\\icon-light.ico'),
      updateShortcut: vi.fn()
    }

    const result = await updateDesktopShortcutStyle('light', deps)
    expect(result.success).toBe(false)
    expect(result.message).toContain('未在桌面检测到 DevHub 快捷方式')
  })

  it('updates all existing shortcuts and returns success', async () => {
    const updateShortcut = vi.fn().mockResolvedValue(undefined)
    const deps: DesktopShortcutDeps = {
      platform: 'win32',
      env: {
        USERPROFILE: 'C:\\Users\\tester',
        PUBLIC: 'C:\\Users\\Public'
      },
      exists: vi.fn().mockResolvedValue(true),
      resolveIconPath: vi.fn().mockResolvedValue('C:\\resources\\icon-light.ico'),
      updateShortcut
    }

    const result = await updateDesktopShortcutStyle('light', deps)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已成功将快捷方式切换为浅色风格图标')
    expect(updateShortcut).toHaveBeenCalledTimes(2)
  })

  it('handles update failure gracefully', async () => {
    const deps: DesktopShortcutDeps = {
      platform: 'win32',
      env: { USERPROFILE: 'C:\\Users\\tester' },
      exists: vi.fn().mockResolvedValue(true),
      resolveIconPath: vi.fn().mockResolvedValue('C:\\resources\\icon-dark.ico'),
      updateShortcut: vi.fn().mockRejectedValue(new Error('Access Denied'))
    }

    const result = await updateDesktopShortcutStyle('dark', deps)
    expect(result.success).toBe(false)
    expect(result.message).toContain('更新快捷方式失败：Access Denied')
  })
})
