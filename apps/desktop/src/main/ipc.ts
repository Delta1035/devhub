import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
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
import { parseExternalUrl } from './core/shell/external-url'
import { resolveProjectFolder } from './core/shell/project-folder'

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
}
