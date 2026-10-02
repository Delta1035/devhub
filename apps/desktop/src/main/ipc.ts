import { BrowserWindow, dialog, ipcMain } from 'electron'
import {
  DevhubError,
  devhubApiMethods,
  devhubEventChannel,
  ipcChannel,
  shellChannel,
  type DevhubApi,
  type DevhubEvents,
  type IpcResult
} from '@devhub/shared'

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
}

async function toIpcResult(name: string, run: () => Promise<unknown>): Promise<IpcResult<unknown>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    if (error instanceof DevhubError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }
    console.error(`[ipc] ${name} failed`, error)
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, error: { code: 'INTERNAL', message: `内部错误：${detail}` } }
  }
}
