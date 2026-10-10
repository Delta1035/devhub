import { createRemoteClient, type RemoteClient } from '@devhub/shared'

/** Which desktop to reach (`''`: the one serving this page) and the token it accepts. */
export interface SavedConnection {
  baseUrl: string
  token: string | null
}

/** Keeps the connection across restarts: localStorage in the web app, the Keystore in the app. */
export interface ConnectionStorage {
  load(): Promise<SavedConnection>
  save(connection: SavedConnection): Promise<void>
}

/** The web app's and the Android app's link to a desktop (ADR 0022, ADR 0027). */
export interface RemoteConnection {
  client: RemoteClient
  /** The Android app connects to a desktop the user names; the web app to the one serving it. */
  choosesAddress: boolean
  /** Reads the saved connection. Called once, before the first request. */
  restore(): Promise<SavedConnection>
  current(): SavedConnection
  /** Switches to this desktop and token, and saves them. */
  connect(connection: SavedConnection): void
  /** Forgets the token; the address stays, so only the token needs entering again. */
  clearToken(): void
  /** Called when the desktop rejects the token (regenerated, or never valid). */
  onUnauthorized(listener: () => void): () => void
}

export function createRemoteConnection({
  storage,
  choosesAddress
}: {
  storage: ConnectionStorage
  choosesAddress: boolean
}): RemoteConnection {
  let state: SavedConnection = { baseUrl: '', token: null }
  let restored: Promise<SavedConnection> | undefined
  const unauthorized = new Set<() => void>()

  const update = (next: SavedConnection): void => {
    state = next
    storage.save(next).catch((error: unknown) => {
      // The connection then lasts until the app is closed.
      console.warn('[remote] could not save the connection', error)
    })
  }

  const client = createRemoteClient({
    baseUrl: () => state.baseUrl,
    token: () => state.token ?? '',
    fetch: (url, init) => window.fetch(url, init),
    createDecoder: () => {
      const decoder = new TextDecoder()
      return (chunk) => decoder.decode(chunk, { stream: true })
    },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onUnauthorized: () => unauthorized.forEach((listener) => listener()),
    // An unreachable desktop otherwise keeps the connect page on "connecting" for minutes.
    sessionTimeoutMs: 10_000
  })

  return {
    client,
    choosesAddress,
    restore() {
      restored ??= storage.load().then((saved) => (state = saved))
      return restored
    },
    current: () => state,
    connect: update,
    clearToken: () => update({ ...state, token: null }),
    onUnauthorized(listener) {
      unauthorized.add(listener)
      return () => unauthorized.delete(listener)
    }
  }
}
