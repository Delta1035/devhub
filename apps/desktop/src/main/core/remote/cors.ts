import type { IncomingMessage, ServerResponse } from 'http'

/**
 * The Android app's page origin: Capacitor serves the bundled web app from `http://localhost`
 * (`androidScheme: 'http'`, ADR 0027), so its calls to the desktop are cross-origin. The hosted
 * web app is same-origin and needs no CORS. No other origin is allowed: the token still guards
 * every call, but a page the user happens to visit should not even get to try it.
 */
export const appOrigin = 'http://localhost'

const preflightHeaders = {
  'access-control-allow-methods': 'GET, POST',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '600'
}

/**
 * Adds the CORS headers for an allowed origin to whatever response follows (JSON, errors and the
 * event stream alike: the app must be able to read a 401). Answers a preflight itself and returns
 * true when it did.
 */
export function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  const allowed = request.headers.origin === appOrigin
  response.setHeader('vary', 'Origin')
  if (allowed) response.setHeader('access-control-allow-origin', appOrigin)
  if (request.method !== 'OPTIONS') return false

  if (!allowed) {
    response.writeHead(403).end()
    return true
  }
  response.writeHead(204, {
    ...preflightHeaders,
    // Chromium's Private Network Access asks before a page reaches a private address.
    ...(request.headers['access-control-request-private-network'] === 'true'
      ? { 'access-control-allow-private-network': 'true' }
      : {})
  })
  response.end()
  return true
}
