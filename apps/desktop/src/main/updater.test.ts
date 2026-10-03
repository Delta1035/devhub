import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shellChannel } from '@devhub/shared'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, () => Promise<unknown>>(),
  listeners: new Map<string, (info: { version: string }) => void>(),
  quitAndInstall: vi.fn()
}))

vi.mock('electron', () => ({
  app: { isPackaged: true },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {
    handle: (channel: string, handler: () => Promise<unknown>) =>
      mocks.handlers.set(channel, handler)
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: (event: string, listener: (info: { version: string }) => void) =>
      mocks.listeners.set(event, listener),
    quitAndInstall: mocks.quitAndInstall
  }
}))

import { registerUpdater } from './updater'

const install = () => mocks.handlers.get(shellChannel.installUpdate)!()
const ready = () => mocks.listeners.get('update-downloaded')!({ version: '0.2.0' })

describe('update installation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('APPIMAGE', '/tmp/devhub.AppImage')
    mocks.handlers.clear()
    mocks.listeners.clear()
    mocks.quitAndInstall.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('waits for managed processes to stop before installing, even with repeated requests', async () => {
    let finishStopping = () => {}
    const stopRuns = vi.fn(() => new Promise<void>((resolve) => (finishStopping = resolve)))
    registerUpdater(stopRuns)
    ready()

    const pending = install()
    await install()
    expect(stopRuns).toHaveBeenCalledTimes(1)
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()

    finishStopping()
    expect(await pending).toEqual({ ok: true, value: undefined })
    await install()
    expect(stopRuns).toHaveBeenCalledTimes(1)
    expect(mocks.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('does not install when stopping managed processes fails', async () => {
    registerUpdater(async () => {
      throw new Error('Unable to stop managed processes')
    })
    ready()

    expect(await install()).toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Unable to stop managed processes' }
    })
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
    expect(await mocks.handlers.get(shellChannel.getUpdateStatus)!()).toEqual({
      ok: true,
      value: { state: 'error', message: 'Unable to stop managed processes' }
    })
  })

  it('does not stop processes or install before an update has downloaded', async () => {
    const stopRuns = vi.fn(async () => {})
    registerUpdater(stopRuns)
    await install()
    expect(stopRuns).not.toHaveBeenCalled()
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })
})
