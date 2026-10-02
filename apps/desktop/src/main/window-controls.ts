import { BrowserWindow, ipcMain } from 'electron'
import { shellChannel, type WindowState } from '@devhub/shared'
import { toIpcResult } from './ipc'

/** Handlers behind the renderer's own title bar buttons (ADR 0010); each acts on the caller's window. */
export function registerWindowControls(): void {
  const handle = (channel: string, run: (window: BrowserWindow) => unknown): void => {
    ipcMain.handle(channel, (event) =>
      toIpcResult(channel, async () => {
        const window = BrowserWindow.fromWebContents(event.sender)
        return window ? run(window) : undefined
      })
    )
  }

  handle(shellChannel.getWindowState, windowState)
  handle(shellChannel.minimizeWindow, (window) => window.minimize())
  handle(shellChannel.toggleMaximizeWindow, (window) =>
    window.isMaximized() ? window.unmaximize() : window.maximize()
  )
  // Goes through the window's 'close' handler, so "keep in tray" / "quit" still applies.
  handle(shellChannel.closeWindow, (window) => window.close())
}

/** Pushes the window's state to its renderer whenever it changes. */
export function publishWindowState(window: BrowserWindow): void {
  const send = (): void => {
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(shellChannel.windowState, windowState(window))
    }
  }
  window.on('maximize', send)
  window.on('unmaximize', send)
  window.on('enter-full-screen', send)
  window.on('leave-full-screen', send)
}

function windowState(window: BrowserWindow): WindowState {
  return {
    platform: process.platform,
    maximized: window.isMaximized(),
    fullScreen: window.isFullScreen()
  }
}
