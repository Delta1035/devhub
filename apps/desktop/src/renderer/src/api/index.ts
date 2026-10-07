import type { DevhubApi, DevhubEvents, ShellApi } from '@devhub/shared'
import { createRemoteConnection, type RemoteConnection } from './remote-connection'
import { webStorage } from './web-storage'
import { createAppUpdates, type AppUpdates } from './app-update'

declare global {
  interface Window {
    /** Present inside the Electron app (preload); absent in the web app. */
    devhub?: DevhubApi
    devhubEvents?: DevhubEvents
    devhubShell?: ShellApi
    /** Injected by the Android app's native bridge (Capacitor, ADR 0027) before the page runs. */
    Capacitor?: { isNativePlatform(): boolean }
  }
}

/** The Android app: the web app packaged with Capacitor, talking to a desktop the user names. */
const nativeApp = window.Capacitor?.isNativePlatform() === true

/**
 * The web app (phone) and the Android app, which have no preload bridge: they reach the core
 * through a desktop's remote server over HTTP + SSE (ADR 0022). Null inside the Electron app.
 */
export const remote: RemoteConnection | null = window.devhub
  ? null
  : createRemoteConnection(
      nativeApp
        ? {
            storage: {
              load: async () => (await import('./native-app')).loadConnection(),
              save: async (connection) => (await import('./native-app')).saveConnection(connection)
            },
            choosesAddress: true
          }
        : { storage: webStorage, choosesAddress: false }
    )

if (nativeApp) void import('./native-app').then((app) => app.handleBackButton())

/** Live updates of the Android app's web bundle (ADR 0030); null elsewhere. */
export const appUpdates: AppUpdates | null = nativeApp
  ? createAppUpdates(() => import('./native-live-update'))
  : null

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
