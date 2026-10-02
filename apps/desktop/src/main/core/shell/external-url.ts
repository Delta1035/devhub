import { z } from 'zod'
import { DevhubError } from '@devhub/shared'

const maxUrlLength = 2048
const allowedProtocols = new Set(['http:', 'https:'])

const urlInput = z.string().trim().min(1).max(maxUrlLength)

/**
 * Validates a URL before it is handed to the OS (browser). Links come from untrusted process
 * output, so anything but http(s) — file:, javascript:, custom protocol handlers — is refused.
 * Returns the normalized URL.
 */
export function parseExternalUrl(raw: unknown): string {
  const parsed = urlInput.safeParse(raw)
  if (parsed.success && URL.canParse(parsed.data)) {
    const url = new URL(parsed.data)
    if (allowedProtocols.has(url.protocol)) return url.href
  }
  throw new DevhubError('INVALID_INPUT', '只能打开 http / https 链接')
}
