/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Android app only: where releases' web bundles are, `{version}` standing for the version
   * (ADR 0030). Defaults to the GitHub release downloads; set it to test updates locally.
   */
  readonly VITE_LIVE_UPDATE_URL?: string
}
