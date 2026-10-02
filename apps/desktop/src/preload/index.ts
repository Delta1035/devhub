import { contextBridge, ipcRenderer } from 'electron'
import {
  devhubApiMethods,
  ipcChannel,
  shellChannel,
  type DevhubApi,
  type IpcResult,
  type ShellApi
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
  pickDirectory: () => invoke(shellChannel.pickDirectory) as Promise<string | null>
}

contextBridge.exposeInMainWorld('devhub', api)
contextBridge.exposeInMainWorld('devhubShell', shell)
