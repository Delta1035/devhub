/**
 * The contract between any UI (desktop renderer, future mobile/PWA) and the DevHub core.
 * Transports (Electron IPC today, HTTP/WebSocket later) must implement exactly this interface.
 * Every method returns a Promise so the contract stays transport-agnostic.
 */
export interface DevhubApi {
  getAppInfo(): Promise<AppInfo>
}

export interface AppInfo {
  version: string
  platform: string
}

export type DevhubApiMethod = keyof DevhubApi

/** Runtime list of API methods; the type assertion below keeps it in sync with the interface. */
export const devhubApiMethods = ['getAppInfo'] as const satisfies readonly DevhubApiMethod[]

type MissingMethods = Exclude<DevhubApiMethod, (typeof devhubApiMethods)[number]>
const assertAllMethodsListed: MissingMethods extends never ? true : MissingMethods = true
void assertAllMethodsListed

export const ipcChannel = (method: DevhubApiMethod): string => `devhub:${method}`
