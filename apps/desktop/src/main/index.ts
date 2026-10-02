import { app, BrowserWindow, Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createDevhubCore } from './core/devhub-core'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null
// Module-level reference keeps the tray icon from being garbage-collected.
let tray: Tray | null = null
let isQuitting = false

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createMainWindow(() => !isQuitting)
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// Only one DevHub may own the managed processes at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.devhub.desktop')
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    registerIpcHandlers(createDevhubCore({ version: app.getVersion(), platform: process.platform }))

    tray = createTray({ show: showMainWindow, quit: () => app.quit() })
    showMainWindow()
  })

  app.on('before-quit', () => {
    isQuitting = true
    tray?.destroy()
  })

  // Keep running in the tray when all windows are closed.
  app.on('window-all-closed', () => {})
}
