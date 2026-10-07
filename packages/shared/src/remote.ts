import { z } from 'zod'
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
  openInSystemTerminal: 'local',
  getRemoteState: 'local',
  updateRemoteConfig: 'local',
  regenerateRemoteToken: 'local'
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

/** Body of `GET ${remoteApiPrefix}/session`: checks the token and says what this client may do. */
export interface RemoteSession {
  protocol: number
  /** Whether `terminal` methods (new shells, terminal input) are allowed. */
  allowTerminal: boolean
  /**
   * The desktop's version. The Android app loads the web bundle of the same version (ADR 0030).
   * Absent from desktops before 1.4.
   */
  appVersion?: string
}

/** An address of this machine the remote server can listen on. */
export interface NetworkAddress {
  address: string
  family: 'IPv4' | 'IPv6'
  /** Network adapter name, e.g. `Tailscale` or `eth0`. */
  interfaceName: string
  /** In Tailscale's ranges (100.64.0.0/10, fd7a:115c:a1e0::/48): encrypted, recommended. */
  tailscale: boolean
  /** In 198.18.0.0/15, used by proxy TUN adapters (Clash, Mihomo, Surge): phones usually cannot reach it. */
  virtual: boolean
}

export type RemoteStatus =
  { state: 'off' } | { state: 'listening'; port: number } | { state: 'error'; message: string }

/** Everything the desktop settings page shows about remote access; local only (has the token). */
export interface RemoteState {
  enabled: boolean
  /** Listen address: one of `addresses`, `127.0.0.1`, or `0.0.0.0` for every interface. */
  host: string
  port: number
  allowTerminal: boolean
  token: string
  status: RemoteStatus
  /** Current addresses of this machine, Tailscale, then LAN, proxy adapters last; loopback and link-local excluded. */
  addresses: NetworkAddress[]
}

export const remoteConfigPatchSchema = z
  .object({
    enabled: z.boolean(),
    host: z.string().min(1).max(64),
    port: z.number().int().min(1024).max(65535),
    allowTerminal: z.boolean()
  })
  .partial()
  .strict()
export type RemoteConfigPatch = z.infer<typeof remoteConfigPatchSchema>

/**
 * What the connection QR code encodes (ADR 0023). The token sits in the fragment, which
 * browsers never send to the server, so it stays out of request logs.
 */
export function remoteConnectUrl(host: string, port: number, token: string): string {
  const hostPart = host.includes(':') ? `[${host}]` : host
  return `http://${hostPart}:${port}/#token=${encodeURIComponent(token)}`
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
