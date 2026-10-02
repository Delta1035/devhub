import { app, BrowserWindow, Tray } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createDevhubCore, type DevhubCore } from './core/devhub-core'
import { registerIpcHandlers } from './ipc'
import { createMainWindow } from './window'
import { createTray } from './tray'

let mainWindow: BrowserWindow | null = null
// Module-level reference keeps the tray icon from being garbage-collected.
let tray: Tray | null = null
let isQuitting = false
let core: DevhubCore | null = null
let disposed = false

// Upper bound for stopping managed processes on quit; a stuck process must not block exit.
const disposeTimeoutMs = 10_000

function showMainWindow(): void {
  if (!mainWindow) {
    mainWindow = createMainWindow(() => !isQuitting)
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// `pnpm dev` would otherwise share userData (and the single-instance lock) with an installed
// DevHub, so the dev build quits immediately and Chromium fails to open its locked caches.
// An explicit --user-data-dir (e.g. from E2E) still wins.
if (is.dev && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', `${app.getPath('userData')}-dev`)
}

// Only one DevHub may own the managed processes at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.devhub.desktop')
    // Packaged builds use build/icon.icns; in dev the Dock would otherwise show Electron's icon.
    if (is.dev) app.dock?.setIcon(icon)
    app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

    core = createDevhubCore({
      version: app.getVersion(),
      platform: process.platform,
      dataDir: app.getPath('userData')
    })
    registerIpcHandlers(core)

    tray = createTray({ show: showMainWindow, quit: () => app.quit() })
    showMainWindow()
  })

  app.on('before-quit', (event) => {
    isQuitting = true
    if (!core || disposed) {
      tray?.destroy()
      return
    }
    // Stop managed process trees first, then quit for real.
    event.preventDefault()
    disposed = true
    const timeout = new Promise((resolve) => setTimeout(resolve, disposeTimeoutMs))
    void Promise.race([core.dispose(), timeout])
      .catch((error: unknown) => console.error('[quit] failed to stop runs', error))
      .finally(() => app.quit())
  })

  // Keep running in the tray when all windows are closed.
  app.on('window-all-closed', () => {})
}
