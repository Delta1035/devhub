import { readFile, stat } from 'fs/promises'
import type { IncomingMessage, ServerResponse } from 'http'
import { extname, isAbsolute, join, normalize, relative } from 'path'

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
}

/**
 * Serves the built web app (`out/web`) to phones (ADR 0022). Needs no token: the files hold no
 * data, and the app asks for the token itself. Unknown paths without an extension get
 * index.html, so reloading the page anywhere still works.
 */
export async function serveStaticFile(
  request: IncomingMessage,
  response: ServerResponse,
  webRoot: string | undefined
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(response, 405, '请求方法不支持', { allow: 'GET, HEAD' })
  }
  if (!webRoot) return plain(response, 404, '网页版未构建：运行 pnpm build:web')

  let path: string
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    return plain(response, 400, '请求格式无效')
  }
  const file = resolveInside(webRoot, path === '/' ? 'index.html' : path)
  if (!file) return plain(response, 404, '没有这个页面')

  const target = (await isFile(file))
    ? file
    : extname(file) === ''
      ? join(webRoot, 'index.html')
      : null
  if (!target || !(await isFile(target))) return plain(response, 404, '没有这个页面')

  const body = await readFile(target)
  const isIndex = target.endsWith('index.html')
  response.writeHead(200, {
    'content-type': contentTypes[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.length,
    // Built assets have content hashes in their names; the page itself must always be fresh.
    'cache-control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
    ...securityHeaders
  })
  response.end(request.method === 'HEAD' ? undefined : body)
}

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer'
}

/** The file under `root` that `urlPath` names, or null when it would escape the directory. */
export function resolveInside(root: string, urlPath: string): string | null {
  if (urlPath.includes('\0')) return null
  const file = join(root, normalize(urlPath.replace(/^[/\\]+/, '')))
  const inside = relative(root, file)
  if (inside.startsWith('..') || isAbsolute(inside)) return null
  return file
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function plain(
  response: ServerResponse,
  status: number,
  message: string,
  headers: Record<string, string> = {}
): void {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    ...securityHeaders,
    ...headers
  })
  response.end(message)
}
