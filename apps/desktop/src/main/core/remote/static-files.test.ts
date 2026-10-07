import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { request } from 'http'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DevhubApi } from '@devhub/shared'
import { startRemoteServer, type RemoteServer } from './remote-server'
import { resolveInside } from './static-files'

/** Sends the path exactly as written; fetch would normalize `..` away before it is sent. */
const rawGet = (port: number, path: string): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path, method: 'GET' }, (response) => {
      let body = ''
      response.on('data', (chunk: Buffer) => (body += chunk.toString()))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
    })
      .on('error', reject)
      .end()
  })

describe('static web app', () => {
  let dir: string
  let webRoot: string
  let server: RemoteServer | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-web-'))
    webRoot = join(dir, 'web')
    await mkdir(join(webRoot, 'assets'), { recursive: true })
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>DevHub</title>')
    await writeFile(join(webRoot, 'assets', 'app-1a2b.js'), 'console.log(1)')
    await writeFile(join(dir, 'secret.txt'), 'outside')
  })

  afterEach(async () => {
    await server?.close()
    server = undefined
    await rm(dir, { recursive: true, force: true })
  })

  /** `null`: no web app built. */
  const start = async (root: string | null = webRoot): Promise<number> => {
    server = await startRemoteServer({
      api: {} as DevhubApi,
      appVersion: '1.2.3',
      subscribe: () => () => undefined,
      host: '127.0.0.1',
      port: 0,
      token: 'x'.repeat(43),
      allowTerminal: false,
      webRoot: root ?? undefined
    })
    return server.port
  }

  it('serves the page without a token, never cached, with framing blocked', async () => {
    const port = await start()
    const response = await fetch(`http://127.0.0.1:${port}/`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(await response.text()).toContain('<title>DevHub</title>')
  })

  it('serves hashed assets with long caching', async () => {
    const port = await start()
    const response = await fetch(`http://127.0.0.1:${port}/assets/app-1a2b.js`)
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect(await response.text()).toBe('console.log(1)')
  })

  it('answers app routes with the page and missing files with 404', async () => {
    const port = await start()
    expect(await (await fetch(`http://127.0.0.1:${port}/projects/abc`)).text()).toContain('DevHub')
    expect((await fetch(`http://127.0.0.1:${port}/missing.png`)).status).toBe(404)
  })

  it.each([
    '/../secret.txt',
    '/..%2fsecret.txt',
    '/assets/..%2f..%2fsecret.txt',
    '/%2e%2e/secret.txt'
  ])('never serves files outside the web app: %s', async (path) => {
    const port = await start()
    const response = await rawGet(port, path)
    expect(response.status).toBe(404)
    expect(response.body).not.toContain('outside')
  })

  it('keeps /api for the API', async () => {
    const port = await start()
    const response = await fetch(`http://127.0.0.1:${port}/api/nothing`)
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('rejects other methods and explains when the web app was not built', async () => {
    let port = await start()
    expect((await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' })).status).toBe(405)
    await server!.close()
    port = await start(null)
    const response = await fetch(`http://127.0.0.1:${port}/`)
    expect(response.status).toBe(404)
    expect(await response.text()).toContain('pnpm build:web')
  })
})

describe('resolveInside', () => {
  const root = join(tmpdir(), 'web')

  it.each([
    ['index.html', join(root, 'index.html')],
    ['/assets/a.js', join(root, 'assets', 'a.js')],
    ['/../x', null],
    ['\\..\\x', null],
    ['/a/../../x', null],
    ['/a\0b', null]
  ])('%s → %s', (path, expected) => {
    expect(resolveInside(root, path)).toBe(expected)
  })
})
