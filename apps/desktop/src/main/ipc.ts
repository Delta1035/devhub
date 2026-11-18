import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import {
  DevhubError,
  devhubApiMethods,
  devhubEventChannel,
  ipcChannel,
  shellChannel,
  type DevhubApi,
  type DevhubEvents
} from '@devhub/shared'
import { toIpcResult } from './core/api-result'
import { isDirectory } from './core/fs/is-directory'
import { updateDesktopShortcutStyle, type ShortcutIconStyle } from './core/shell/desktop-shortcut'
import { parseExternalUrl } from './core/shell/external-url'
import { resolveProjectFolder } from './core/shell/project-folder'

const execFileAsync = promisify(execFile)

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

async function resolveShortcutIconPath(style: ShortcutIconStyle): Promise<string | null> {
  const candidates = [
    join(process.resourcesPath, `icon-${style}.ico`),
    join(process.resourcesPath, 'app.asar.unpacked', 'resources', `icon-${style}.ico`),
    join(app.getAppPath(), 'resources', `icon-${style}.ico`),
    join(app.getAppPath(), '..', 'resources', `icon-${style}.ico`),
    join(__dirname, '../../resources', `icon-${style}.ico`),
    join(process.cwd(), 'apps/desktop/resources', `icon-${style}.ico`),
    join(process.cwd(), 'resources', `icon-${style}.ico`),
    join(__dirname, '../../build', `icon-${style}.ico`)
  ]
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate
  }
  return null
}

async function updateWindowsShortcut(shortcutPath: string, iconPath: string): Promise<void> {
  const script = `
    $ws = New-Object -ComObject WScript.Shell
    $s = $ws.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
    $s.IconLocation = '${iconPath.replace(/'/g, "''")},0'
    $s.Save()
    try {
      $code = '[DllImport("shell32.dll")]public static extern void SHChangeNotify(int id, uint flags, IntPtr p1, IntPtr p2);'
      $type = Add-Type -MemberDefinition $code -Name 'NativeMethods' -Namespace 'ShellIcon' -PassThru
      $type::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    } catch {}
    try { ie4uinit.exe -show } catch {}
  `
  await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 5000
  })
}

type AnyApiMethod = (...args: unknown[]) => Promise<unknown>

/**
 * Exposes every DevhubApi method over IPC, wrapping results in an IpcResult envelope,
 * and forwards core events to every window (hidden ones too, so state stays current).
 */
export function registerIpcHandlers(core: DevhubApi & DevhubEvents): void {
  core.subscribe((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed()) window.webContents.send(devhubEventChannel, event)
    }
  })

  for (const method of devhubApiMethods) {
    const handler = core[method] as AnyApiMethod
    ipcMain.handle(ipcChannel(method), (_event, ...args: unknown[]) =>
      toIpcResult(method, () => handler(...args))
    )
  }

  ipcMain.handle(shellChannel.pickDirectory, (event) =>
    toIpcResult('pickDirectory', async () => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = { properties: ['openDirectory' as const] }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    })
  )

  ipcMain.handle(shellChannel.pickFile, (event, title: unknown) =>
    toIpcResult('pickFile', async () => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: typeof title === 'string' ? title.slice(0, 100) : undefined,
        properties: ['openFile' as const]
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    })
  )

  ipcMain.handle(shellChannel.openExternal, (_event, url: unknown) =>
    toIpcResult('openExternal', () => shell.openExternal(parseExternalUrl(url)))
  )

  ipcMain.handle(shellChannel.openProjectFolder, (_event, projectId: unknown) =>
    toIpcResult('openProjectFolder', async () => {
      const folder = await resolveProjectFolder(projectId, {
        listProjects: () => core.listProjects(),
        isDirectory
      })
      // Resolves to an error message rather than rejecting.
      const failure = await shell.openPath(folder)
      if (failure) throw new DevhubError('OPEN_FOLDER_FAILED', `无法打开目录：${failure}`)
    })
  )

  ipcMain.handle(shellChannel.setDesktopShortcutStyle, (_event, style: unknown) =>
    toIpcResult('setDesktopShortcutStyle', async () => {
      const parsedStyle = style === 'light' || style === 'dark' ? style : 'dark'
      return updateDesktopShortcutStyle(parsedStyle, {
        platform: process.platform,
        env: process.env,
        exists: fileExists,
        resolveIconPath: resolveShortcutIconPath,
        updateShortcut: updateWindowsShortcut
      })
    })
  )
}
