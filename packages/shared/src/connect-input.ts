import { defaultRemotePort } from './remote'

/** Where to reach a desktop's remote server, and the token it accepts. */
export interface ConnectionSettings {
  /** Origin only, e.g. `http://192.168.1.5:7420`. */
  baseUrl: string
  token: string
}

/**
 * Reads what the user typed or pasted as the address: a bare host, `host:port`, an origin, or
 * the whole connect link from the desktop's QR code (`remoteConnectUrl`, ADR 0023), whose
 * `#token=` fragment is returned as well. Regular expressions rather than `URL`: React
 * Native's `URL` is not a complete implementation.
 */
export function parseAddress(input: string): { baseUrl: string; token?: string } | null {
  const text = input.trim()
  if (!text) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`
  const match = /^(https?):\/\/(\[[0-9a-f:.]+\]|[^/:?#[\]\s@]+)(?::(\d+))?([/?#].*)?$/i.exec(
    withScheme
  )
  if (!match) return null
  const [, scheme = 'http', host = '', portText, rest = ''] = match
  const port = portText === undefined ? defaultRemotePort : Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  const baseUrl = `${scheme.toLowerCase()}://${host.toLowerCase()}:${port}`
  const token = tokenFromFragment(rest)
  return token ? { baseUrl, token } : { baseUrl }
}

function tokenFromFragment(rest: string): string | undefined {
  const hash = rest.indexOf('#')
  if (hash < 0) return undefined
  for (const pair of rest.slice(hash + 1).split('&')) {
    const [key, value] = pair.split('=')
    if (key === 'token' && value) {
      try {
        return decodeURIComponent(value)
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** Validates the connect form. A token in the address (a pasted link) wins over an empty field. */
export function readConnectForm(
  address: string,
  token: string
): { ok: true; settings: ConnectionSettings } | { ok: false; message: string } {
  const parsed = parseAddress(address)
  if (!parsed) return { ok: false, message: '地址格式不正确，例如 192.168.1.5:7420' }
  const finalToken = token.trim() || parsed.token
  if (!finalToken) return { ok: false, message: '请填写 Token，或粘贴桌面端的连接地址' }
  return { ok: true, settings: { baseUrl: parsed.baseUrl, token: finalToken } }
}

/**
 * Why a cross-origin client (the Android app) could not reach a desktop, given what a native
 * request to `/api/v1/info` returned (null when it failed too). Native requests are not subject
 * to CORS: if the desktop answers one, the page's request was blocked by CORS, which desktops
 * before 1.4 do not grant to the app's origin.
 */
export function explainConnectFailure(info: unknown): 'outdated-desktop' | 'unreachable' {
  const answered =
    typeof info === 'object' &&
    info !== null &&
    typeof (info as { protocol?: unknown }).protocol === 'number'
  return answered ? 'outdated-desktop' : 'unreachable'
}
