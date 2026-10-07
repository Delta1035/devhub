/*
 * What the Android app's live update is doing (ADR 0030), for the UI to show. The work happens in
 * `native-live-update.ts`, loaded only inside the app; this module holds no plugin code.
 */

export type AppUpdateState =
  | { state: 'idle' }
  | { state: 'downloading'; version: string }
  /** The web bundle of this version starts with the next restart. */
  | { state: 'ready'; version: string }
  /** The desktop's version needs native code this APK lacks. */
  | { state: 'install-apk'; version: string }
  | { state: 'failed'; version: string; message: string }

export interface AppUpdates {
  get(): AppUpdateState
  subscribe(listener: () => void): () => void
  /** Tells the plugin this bundle started fine (else it rolls back). Call once rendered. */
  confirm(): void
  /** Brings the desktop's web bundle to this app, or back to the built-in one. */
  sync(desktopVersion: string | undefined): void
  /** Restarts the web view on the bundle that is ready. */
  restart(): void
  dismiss(): void
}

export function createAppUpdates(
  load: () => Promise<{
    confirmBundle(): Promise<void>
    syncWebBundle(
      desktopVersion: string | undefined,
      set: (next: AppUpdateState) => void
    ): Promise<void>
    restartWebView(): Promise<void>
  }>
): AppUpdates {
  let current: AppUpdateState = { state: 'idle' }
  const listeners = new Set<() => void>()
  const set = (next: AppUpdateState): void => {
    current = next
    listeners.forEach((listener) => listener())
  }
  let running: Promise<void> | null = null

  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    confirm() {
      void load()
        .then((native) => native.confirmBundle())
        .catch((error: unknown) => console.warn('[live-update] could not confirm', error))
    },
    sync(desktopVersion) {
      // One sync at a time; a reconnect while one runs has nothing new to add.
      running ??= load()
        .then((native) => native.syncWebBundle(desktopVersion, set))
        .catch((error: unknown) => console.warn('[live-update] sync failed', error))
        .finally(() => (running = null))
    },
    restart() {
      void load().then((native) => native.restartWebView())
    },
    dismiss: () => set({ state: 'idle' })
  }
}
