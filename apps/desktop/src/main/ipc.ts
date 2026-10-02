import { ipcMain } from 'electron'
import { devhubApiMethods, ipcChannel, type DevhubApi } from '@devhub/shared'

type AnyApiMethod = (...args: unknown[]) => Promise<unknown>

/** Exposes every DevhubApi method over IPC. Validate renderer input with zod inside the core. */
export function registerIpcHandlers(core: DevhubApi): void {
  for (const method of devhubApiMethods) {
    const handler = core[method] as AnyApiMethod
    ipcMain.handle(ipcChannel(method), (_event, ...args: unknown[]) => handler(...args))
  }
}
