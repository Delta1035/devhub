import type { DevhubApiMethod } from './api'

/**
 * How far a method may be used by a remote client (ADR 0022).
 * - `read`: only reads state.
 * - `control`: starts / stops what is already registered; cannot add anything new to run.
 * - `terminal`: arbitrary input into a process; only when the user allows remote terminals.
 * - `local`: changes what DevHub would run or launches programs; never remote.
 */
export type RemoteAccess = 'read' | 'control' | 'terminal' | 'local'

/** Every method must be classified: a new method without an entry fails to compile. */
export const remoteAccess = {
  getAppInfo: 'read',
  listProjects: 'read',
  addProject: 'local',
  removeProject: 'local',
  listWorkspaces: 'read',
  addWorkspace: 'local',
  updateWorkspace: 'local',
  removeWorkspace: 'local',
  rescanWorkspaces: 'control',
  listScripts: 'read',
  startScript: 'control',
  checkScriptPorts: 'read',
  listShells: 'read',
  startShell: 'terminal',
  stopRun: 'control',
  restartRun: 'control',
  listRuns: 'read',
  listOrphanedRuns: 'read',
  killOrphanedRuns: 'control',
  dismissOrphanedRuns: 'control',
  listRunHistory: 'read',
  clearRunHistory: 'control',
  getRunHistoryOutput: 'read',
  listRunHealth: 'read',
  getRunOutput: 'read',
  writeRunInput: 'terminal',
  resizeRun: 'control',
  removeRun: 'control',
  getSettings: 'read',
  updateSettings: 'local',
  listGroups: 'read',
  saveGroup: 'local',
  deleteGroup: 'local',
  startGroup: 'control',
  stopGroup: 'control',
  listGroupStates: 'read',
  listEditors: 'read',
  openInEditor: 'local',
  getSystemTerminal: 'read',
  openInSystemTerminal: 'local'
} as const satisfies Record<DevhubApiMethod, RemoteAccess>

export interface RemotePolicy {
  /** Remote terminals (`terminal` methods) are a separate opt-in. */
  allowTerminal: boolean
}

export function isRemoteAllowed(method: DevhubApiMethod, policy: RemotePolicy): boolean {
  const access: RemoteAccess = remoteAccess[method]
  if (access === 'local') return false
  return access !== 'terminal' || policy.allowTerminal
}

/** Bumped on incompatible changes to the remote wire format. */
export const remoteProtocolVersion = 1
/** Requests: `POST ${remoteApiPrefix}/<method>` with a JSON body `{ "args": [...] }`. */
export const remoteApiPrefix = '/api/v1'
export const defaultRemotePort = 7420

/** Body of `GET ${remoteApiPrefix}/info`, the only request that needs no token. */
export interface RemoteInfo {
  protocol: number
}

/** Transport-level failures, answered with the matching HTTP status and an `IpcResult` body. */
export type RemoteErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'TOO_MANY_REQUESTS'
