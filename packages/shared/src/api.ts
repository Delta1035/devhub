import type {
  EditorId,
  EditorInfo,
  Project,
  ProjectScripts,
  Run,
  ShellId,
  ShellInfo
} from './domain'
import type { RunOutputSnapshot } from './events'

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
  /** Starts a detected script. The core resolves the command itself; the UI only sends ids. */
  startScript(projectId: string, scriptId: string): Promise<Run>
  /** Shells installed on this machine; the first one is the default. */
  listShells(): Promise<ShellInfo[]>
  /** Opens an interactive shell in the project directory (the default shell when omitted). */
  startShell(projectId: string, shellId?: ShellId): Promise<Run>
  /** Stops the whole process tree; resolves once the process has exited. */
  stopRun(runId: string): Promise<void>
  restartRun(runId: string): Promise<Run>
  /** Active runs plus the latest exited run of each script. */
  listRuns(): Promise<Run[]>
  /** Recent output; combine with `run-output` events through `OutputCursor`. */
  getRunOutput(runId: string): Promise<RunOutputSnapshot>
  /** Sends terminal input (keystrokes) to an active run. */
  writeRunInput(runId: string, data: string): Promise<void>
  /** Resizes the run's pseudo-terminal; ignored once the run has exited. */
  resizeRun(runId: string, cols: number, rows: number): Promise<void>
  /** Forgets an exited run (closes its terminal tab). */
  removeRun(runId: string): Promise<void>
  /** Editors DevHub knows about and whether each is installed. */
  listEditors(): Promise<EditorInfo[]>
  /** Opens the project directory in the editor, as a separate process DevHub does not manage. */
  openInEditor(projectId: string, editor: EditorId): Promise<void>
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
  'listScripts',
  'startScript',
  'listShells',
  'startShell',
  'stopRun',
  'restartRun',
  'listRuns',
  'getRunOutput',
  'writeRunInput',
  'resizeRun',
  'removeRun',
  'listEditors',
  'openInEditor'
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
  /** Opens an http(s) URL in the default browser; other protocols are rejected. */
  openExternal(url: string): Promise<void>
}

export const shellChannel = {
  pickDirectory: 'shell:pickDirectory',
  openExternal: 'shell:openExternal'
} as const
