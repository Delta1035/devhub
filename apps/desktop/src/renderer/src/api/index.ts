import type { DevhubApi, ShellApi } from '@devhub/shared'

declare global {
  interface Window {
    devhub: DevhubApi
    devhubShell?: ShellApi
  }
}

/**
 * The only entry point for UI code to reach the DevHub core.
 * Today it is the Electron preload bridge; a mobile/PWA build swaps in an HTTP client here.
 */
export const api: DevhubApi = window.devhub

/** Local desktop capabilities (native dialogs). Null when running as a remote client. */
export const shell: ShellApi | null = window.devhubShell ?? null
