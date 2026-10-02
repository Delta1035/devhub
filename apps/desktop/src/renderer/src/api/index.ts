import type { DevhubApi } from '@devhub/shared'

declare global {
  interface Window {
    devhub: DevhubApi
  }
}

/**
 * The only entry point for UI code to reach the DevHub core.
 * Today it is the Electron preload bridge; a mobile/PWA build swaps in an HTTP client here.
 */
export const api: DevhubApi = window.devhub
