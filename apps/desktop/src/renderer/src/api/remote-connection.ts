import { createRemoteClient, type RemoteClient } from '@devhub/shared'

const tokenKey = 'devhub.remoteToken'

/** The web app's link to the desktop that serves it (ADR 0022). */
export interface RemoteConnection {
  client: RemoteClient
  token(): string | null
  /** Saves a token entered by hand. */
  setToken(token: string): void
  clearToken(): void
  /** Called when the desktop rejects the token (regenerated, or never valid). */
  onUnauthorized(listener: () => void): () => void
}

export function createRemoteConnection(): RemoteConnection {
  let token = takeTokenFromUrl() ?? readStoredToken()
  const unauthorized = new Set<() => void>()

  const client = createRemoteClient({
    // The web app is served by the remote server itself, so the API is on the same origin.
    baseUrl: '',
    token: () => token ?? '',
    fetch: (url, init) => window.fetch(url, init),
    createDecoder: () => {
      const decoder = new TextDecoder()
      return (chunk) => decoder.decode(chunk, { stream: true })
    },
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    onUnauthorized: () => unauthorized.forEach((listener) => listener())
  })

  return {
    client,
    token: () => token,
    setToken(value) {
      token = value
      storeToken(value)
    },
    clearToken() {
      token = null
      storeToken(null)
    },
    onUnauthorized(listener) {
      unauthorized.add(listener)
      return () => unauthorized.delete(listener)
    }
  }
}

/**
 * The connection QR code opens `/#token=…` (ADR 0023). The token is saved and removed from the
 * address bar, so it is not left in history or shared along with the link.
 */
function takeTokenFromUrl(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  if (!token) return null
  storeToken(token)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(tokenKey)
  } catch {
    return null
  }
}

function storeToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(tokenKey)
    else window.localStorage.setItem(tokenKey, token)
  } catch {
    // Private browsing: the token then lasts for this page only.
  }
}
