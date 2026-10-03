import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { shellChannel, type IpcResult, type UpdateStatus } from '@devhub/shared'
import { nextUpdateStatus, updateSupport, type UpdaterEvent } from './update-status'

// Checked shortly after start (not during it) and then a few times a day.
const firstCheckDelayMs = 15_000
const checkIntervalMs = 6 * 60 * 60 * 1000

/**
 * Self-update from GitHub Releases (ADR 0009). Never downloads or installs on its own: the
 * user sees "new version" and chooses to download, then to restart.
 */
export function registerUpdater(stopRuns: () => Promise<void>): void {
  const unsupported = updateSupport({
    isPackaged: app.isPackaged,
    platform: process.platform,
    appImage: process.env.APPIMAGE
  })
  let status: UpdateStatus = unsupported
    ? { state: 'unsupported', reason: unsupported }
    : { state: 'idle' }

  const publish = (next: UpdateStatus): void => {
    status = next
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.webContents.isDestroyed())
        window.webContents.send(shellChannel.updateStatus, status)
    }
  }
  const apply = (event: UpdaterEvent): void => publish(nextUpdateStatus(status, event))

  const handle = (channel: string, run: () => Promise<unknown>): void => {
    ipcMain.handle(channel, async (): Promise<IpcResult<unknown>> => {
      try {
        return { ok: true, value: await run() }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, error: { code: 'INTERNAL', message } }
      }
    })
  }

  handle(shellChannel.getUpdateStatus, async () => status)

  if (unsupported) {
    for (const channel of [
      shellChannel.checkForUpdates,
      shellChannel.downloadUpdate,
      shellChannel.installUpdate
    ]) {
      handle(channel, async () => undefined)
    }
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () => apply({ type: 'checking' }))
  autoUpdater.on('update-available', (info) => apply({ type: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => apply({ type: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    apply({ type: 'progress', percent: progress.percent })
  )
  autoUpdater.on('update-downloaded', (info) =>
    apply({ type: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) => apply({ type: 'error', error }))

  // Failures are reported through the 'error' event, so the promises are only awaited to settle.
  const check = (): Promise<void> =>
    autoUpdater.checkForUpdates().then(
      () => undefined,
      () => undefined
    )

  handle(shellChannel.checkForUpdates, check)
  handle(shellChannel.downloadUpdate, () =>
    autoUpdater.downloadUpdate().then(
      () => undefined,
      () => undefined
    )
  )
  // electron-updater starts the installer before app.quit emits before-quit.
  // Finish stopping managed processes before allowing it to replace the app.
  let installing = false
  handle(shellChannel.installUpdate, async () => {
    if (installing || status.state !== 'downloaded') return
    installing = true
    try {
      await stopRuns()
      autoUpdater.quitAndInstall()
    } catch (error) {
      installing = false
      apply({ type: 'error', error })
      throw error
    }
  })

  setTimeout(() => void check(), firstCheckDelayMs)
  setInterval(() => void check(), checkIntervalMs).unref()
}
