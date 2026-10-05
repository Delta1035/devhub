import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  devhubApiMethods,
  devhubEventChannel,
  ipcChannel,
  shellChannel,
  type DevhubApi,
  type DevhubEvent,
  type DevhubEvents,
  type IpcResult,
  type ShellApi,
  type UpdateStatus,
  type WindowState
} from '@devhub/shared'

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<unknown>
  if (result.ok) return result.value
  throw new Error(result.error.message)
}

const api = Object.fromEntries(
  devhubApiMethods.map((method) => [
    method,
    (...args: unknown[]) => invoke(ipcChannel(method), ...args)
  ])
) as unknown as DevhubApi

const shell: ShellApi = {
  pickDirectory: () => invoke(shellChannel.pickDirectory) as Promise<string | null>,
  pickFile: (title) => invoke(shellChannel.pickFile, title) as Promise<string | null>,
  getUpdateStatus: () => invoke(shellChannel.getUpdateStatus) as Promise<UpdateStatus>,
  checkForUpdates: async () => {
    await invoke(shellChannel.checkForUpdates)
  },
  downloadUpdate: async () => {
    await invoke(shellChannel.downloadUpdate)
  },
  installUpdate: async () => {
    await invoke(shellChannel.installUpdate)
  },
  onUpdateStatus(listener) {
    const handler = (_event: IpcRendererEvent, status: UpdateStatus): void => listener(status)
    ipcRenderer.on(shellChannel.updateStatus, handler)
    return () => {
      ipcRenderer.removeListener(shellChannel.updateStatus, handler)
    }
  },
  openExternal: async (url) => {
    await invoke(shellChannel.openExternal, url)
  },
  openProjectFolder: async (projectId) => {
    await invoke(shellChannel.openProjectFolder, projectId)
  },
  getWindowState: () => invoke(shellChannel.getWindowState) as Promise<WindowState>,
  onWindowState(listener) {
    const handler = (_event: IpcRendererEvent, state: WindowState): void => listener(state)
    ipcRenderer.on(shellChannel.windowState, handler)
    return () => {
      ipcRenderer.removeListener(shellChannel.windowState, handler)
    }
  },
  minimizeWindow: async () => {
    await invoke(shellChannel.minimizeWindow)
  },
  toggleMaximizeWindow: async () => {
    await invoke(shellChannel.toggleMaximizeWindow)
  },
  closeWindow: async () => {
    await invoke(shellChannel.closeWindow)
  }
}

const events: DevhubEvents = {
  subscribe(listener) {
    // Events come from our own main process, so they are trusted and not re-validated.
    const handler = (_event: IpcRendererEvent, event: DevhubEvent): void => listener(event)
    ipcRenderer.on(devhubEventChannel, handler)
    return () => {
      ipcRenderer.removeListener(devhubEventChannel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('devhub', api)
contextBridge.exposeInMainWorld('devhubEvents', events)
contextBridge.exposeInMainWorld('devhubShell', shell)
