import type { ConnectionStorage } from './remote-connection'

const tokenKey = 'devhub.remoteToken'

/**
 * The web app is served by the desktop's remote server, so the API is on the same origin and
 * only the token is kept, in localStorage.
 */
export const webStorage: ConnectionStorage = {
  load: async () => ({ baseUrl: '', token: takeTokenFromUrl() ?? readStoredToken() }),
  save: async ({ token }) => storeToken(token)
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
