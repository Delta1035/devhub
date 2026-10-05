import type { DevhubApi, DevhubEvents, ShellApi } from '@devhub/shared'
import { createRemoteConnection, type RemoteConnection } from './remote-connection'

declare global {
  interface Window {
    /** Present inside the Electron app (preload); absent in the web app. */
    devhub?: DevhubApi
    devhubEvents?: DevhubEvents
    devhubShell?: ShellApi
  }
}

/**
 * The web app (phone) when there is no preload bridge: it reaches the core through the
 * desktop's remote server over HTTP + SSE (ADR 0022). Null inside the Electron app.
 */
export const remote: RemoteConnection | null = window.devhub ? null : createRemoteConnection()

/**
 * The only entry point for UI code to reach the DevHub core: the Electron preload bridge on the
 * desktop, the remote client in the web app.
 */
export const api: DevhubApi = window.devhub ?? remote!.client.api

/** Pushed run updates and output. */
export const events: DevhubEvents = window.devhubEvents ?? remote!.client.events

/** Local desktop capabilities (native dialogs). Null when running as a remote client. */
export const shell: ShellApi | null = window.devhubShell ?? null

/**
 * What this client may do. The desktop may do everything; the web app may not change what runs
 * on the host (`manage`) and may use terminals only when the desktop allows it. Set from the
 * remote session before the app renders (`RemoteGate`).
 */
export const access = {
  manage: remote === null,
  terminal: remote === null
}
