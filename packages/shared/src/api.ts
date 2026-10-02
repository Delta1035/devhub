import type { Project, ProjectScripts } from './domain'

/**
 * The contract between any UI (desktop renderer, future mobile/PWA) and the DevHub core.
 * Transports (Electron IPC today, HTTP/WebSocket later) must implement exactly this interface.
 * Every method returns a Promise so the contract stays transport-agnostic.
 */
export interface DevhubApi {
  getAppInfo(): Promise<AppInfo>
  listProjects(): Promise<Project[]>
  /** Registers an existing local directory. `path` must be absolute. */
  addProject(path: string): Promise<Project>
  removeProject(projectId: string): Promise<void>
  /** Scans the project directory for runnable scripts. Never cached: reflects the files on disk. */
  listScripts(projectId: string): Promise<ProjectScripts>
}

export interface AppInfo {
  version: string
  platform: string
}

export type DevhubApiMethod = keyof DevhubApi

/** Runtime list of API methods; the type assertion below keeps it in sync with the interface. */
export const devhubApiMethods = [
  'getAppInfo',
  'listProjects',
  'addProject',
  'removeProject',
  'listScripts'
] as const satisfies readonly DevhubApiMethod[]

type MissingMethods = Exclude<DevhubApiMethod, (typeof devhubApiMethods)[number]>
const assertAllMethodsListed: MissingMethods extends never ? true : MissingMethods = true
void assertAllMethodsListed

export const ipcChannel = (method: DevhubApiMethod): string => `devhub:${method}`

/**
 * Envelope used on the IPC wire. Electron prefixes thrown error messages, so handlers
 * return this instead and the preload re-throws a clean Error on the renderer side.
 */
export type IpcResult<T> =
  { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/**
 * Capabilities of the local desktop host that make no sense remotely (e.g. native dialogs).
 * Not part of DevhubApi: a mobile client simply does not have a shell.
 */
export interface ShellApi {
  /** Opens a native folder picker; resolves to null when cancelled. */
  pickDirectory(): Promise<string | null>
}

export const shellChannel = { pickDirectory: 'shell:pickDirectory' } as const
