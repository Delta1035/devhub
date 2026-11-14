import type { DevhubApi, DevhubEvents, ShellApi } from '@devhub/shared'
import { createRemoteConnection, type RemoteConnection } from './remote-connection'
import { webStorage } from './web-storage'
import { createAppUpdates, type AppUpdates } from './app-update'
import type { ScanResult } from './native-app'
import { createMockApi, mockEvents } from './mock-api'
import { createMockShell } from './mock-shell'

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
 * Checks whether this browser session has an explicit remote token (URL hash or saved in localStorage).
 * If neither is present and we are not in Electron or Capacitor, activate mock demo mode.
 */
function hasRemoteCredentials(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.hash.includes('token=')) return true
  try {
    return Boolean(window.localStorage.getItem('devhub.remoteToken'))
  } catch {
    return false
  }
}

const isMockPreview = !window.devhub && !nativeApp && !hasRemoteCredentials()

const mockInstance = isMockPreview ? createMockApi() : null
const mockShellInstance = isMockPreview ? createMockShell() : null

/**
 * The web app (phone) and the Android app, which have no preload bridge: they reach the core
 * through a desktop's remote server over HTTP + SSE (ADR 0022). Null inside the Electron app
 * and in standalone browser mock preview.
 */
export const remote: RemoteConnection | null =
  window.devhub || isMockPreview
    ? null
    : createRemoteConnection(
        nativeApp
          ? {
              storage: {
                load: async () => (await import('./native-app')).loadConnection(),
                save: async (connection) =>
                  (await import('./native-app')).saveConnection(connection)
              },
              choosesAddress: true
            }
          : { storage: webStorage, choosesAddress: false }
      )

if (nativeApp) void import('./native-app').then((app) => app.handleBackButton())

/** The Android app's QR scanner for the connect code; null elsewhere. */
export const scanQrCode: (() => Promise<ScanResult>) | null = nativeApp
  ? async () => (await import('./native-app')).scanQrCode()
  : null

/** The Android app's native check of an unreachable desktop (`explainConnectFailure`). */
export const probeDesktop: ((baseUrl: string) => Promise<unknown>) | null = nativeApp
  ? async (baseUrl) => (await import('./native-app')).probeDesktop(baseUrl)
  : null

/** Live updates of the Android app's web bundle (ADR 0030); null elsewhere. */
export const appUpdates: AppUpdates | null = nativeApp
  ? createAppUpdates(() => import('./native-live-update'))
  : null

/**
 * The only entry point for UI code to reach the DevHub core:
 * 1. Electron preload bridge on the desktop (`window.devhub`).
 * 2. Remote HTTP + SSE client in the web / Android app (`remote.client.api`).
 * 3. Mock demo API when exploring in standalone browser mode.
 */
export const api: DevhubApi = window.devhub ?? (remote ? remote.client.api : mockInstance!)

/** Pushed run updates and output. */
export const events: DevhubEvents =
  window.devhubEvents ?? (remote ? remote.client.events : mockEvents)

/** Local desktop capabilities (native dialogs). */
export const shell: ShellApi | null =
  window.devhubShell ?? (isMockPreview ? mockShellInstance : null)

/**
 * What this client may do. The desktop may do everything; the web app may not change what runs
 * on the host (`manage`) and may use terminals only when the desktop allows it.
 * In standalone mock preview, everything is permitted.
 */
export const access = {
  manage: remote === null,
  terminal: remote === null
}
