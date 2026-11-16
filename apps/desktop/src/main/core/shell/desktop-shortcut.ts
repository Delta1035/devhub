import { win32 } from 'path'

export type ShortcutIconStyle = 'light' | 'dark'

export interface DesktopShortcutDeps {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  exists: (path: string) => Promise<boolean>
  resolveIconPath: (style: ShortcutIconStyle) => Promise<string | null>
  updateShortcut: (shortcutPath: string, iconPath: string) => Promise<void>
}

export interface DesktopShortcutResult {
  success: boolean
  message: string
}

/**
 * Finds Windows desktop/start menu shortcuts for DevHub and updates their icon to light or dark style.
 */
export async function updateDesktopShortcutStyle(
  style: ShortcutIconStyle,
  deps: DesktopShortcutDeps
): Promise<DesktopShortcutResult> {
  if (deps.platform !== 'win32') {
    return {
      success: false,
      message: '快捷方式图标切换仅支持 Windows 系统'
    }
  }

  const iconPath = await deps.resolveIconPath(style)
  if (!iconPath || !(await deps.exists(iconPath))) {
    return {
      success: false,
      message: `未找到${style === 'light' ? '浅色' : '深色'}图标文件`
    }
  }

  const candidates: string[] = []
  if (deps.env.USERPROFILE) {
    candidates.push(win32.join(deps.env.USERPROFILE, 'Desktop', 'DevHub.lnk'))
  }
  if (deps.env.PUBLIC) {
    candidates.push(win32.join(deps.env.PUBLIC, 'Desktop', 'DevHub.lnk'))
  }
  if (deps.env.APPDATA) {
    candidates.push(
      win32.join(deps.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'DevHub.lnk'),
      win32.join(
        deps.env.APPDATA,
        'Microsoft',
        'Internet Explorer',
        'Quick Launch',
        'User Pinned',
        'TaskBar',
        'DevHub.lnk'
      )
    )
  }
  if (deps.env.ProgramData) {
    candidates.push(
      win32.join(
        deps.env.ProgramData,
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'DevHub.lnk'
      )
    )
  }

  const existingShortcuts: string[] = []
  for (const candidate of candidates) {
    if (await deps.exists(candidate)) {
      existingShortcuts.push(candidate)
    }
  }

  if (existingShortcuts.length === 0) {
    return {
      success: false,
      message: '未在桌面检测到 DevHub 快捷方式（若已更名请手动更改属性图标）'
    }
  }

  try {
    for (const shortcut of existingShortcuts) {
      await deps.updateShortcut(shortcut, iconPath)
    }
    return {
      success: true,
      message: `已成功将快捷方式切换为${style === 'light' ? '浅色' : '深色'}风格图标`
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: `更新快捷方式失败：${errMessage}`
    }
  }
}
