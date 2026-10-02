import { contextBridge, ipcRenderer } from 'electron'
import { devhubApiMethods, ipcChannel, type DevhubApi } from '@devhub/shared'

const api = Object.fromEntries(
  devhubApiMethods.map((method) => [
    method,
    (...args: unknown[]) => ipcRenderer.invoke(ipcChannel(method), ...args)
  ])
) as unknown as DevhubApi

contextBridge.exposeInMainWorld('devhub', api)
