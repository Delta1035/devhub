import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevhubApi } from '@devhub/shared'
import { appOrigin } from './cors'
import { startRemoteServer, type RemoteServer } from './remote-server'

const token = 'x'.repeat(43)
const otherOrigin = 'http://evil.example'

describe('remote server CORS', () => {
  let server: RemoteServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  const start = async (api: Partial<DevhubApi> = {}): Promise<string> => {
    server = await startRemoteServer({
      api: api as DevhubApi,
      appVersion: '1.2.3',
      subscribe: () => () => undefined,
      host: '127.0.0.1',
      port: 0,
      token,
      allowTerminal: false
    })
    return `http://127.0.0.1:${server.port}`
  }

  const preflight = (url: string, origin: string, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type',
        ...headers
      }
    })

  it('answers the preflight of the Android app', async () => {
    const base = await start()
    const response = await preflight(`${base}/api/v1/listRuns`, appOrigin)
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(appOrigin)
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST')
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type')
    expect(response.headers.get('access-control-allow-private-network')).toBeNull()
  })

  it('allows private network access when the preflight asks for it', async () => {
    const base = await start()
    const response = await preflight(`${base}/api/v1/events`, appOrigin, {
      'access-control-request-private-network': 'true'
    })
    expect(response.headers.get('access-control-allow-private-network')).toBe('true')
  })

  it('lets the app read results and errors', async () => {
    const listRuns = vi.fn(async () => [])
    const base = await start({ listRuns })
    const ok = await fetch(`${base}/api/v1/listRuns`, {
      method: 'POST',
      headers: {
        origin: appOrigin,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: '{}'
    })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('access-control-allow-origin')).toBe(appOrigin)
    expect(ok.headers.get('vary')).toBe('Origin')

    const rejected = await fetch(`${base}/api/v1/session`, { headers: { origin: appOrigin } })
    expect(rejected.status).toBe(401)
    expect(rejected.headers.get('access-control-allow-origin')).toBe(appOrigin)
  })

  it('lets the app open the event stream', async () => {
    const base = await start()
    const response = await fetch(`${base}/api/v1/events`, {
      headers: { origin: appOrigin, authorization: `Bearer ${token}` }
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/)
    expect(response.headers.get('access-control-allow-origin')).toBe(appOrigin)
    await response.body?.cancel()
  })

  it('refuses other origins', async () => {
    const listRuns = vi.fn(async () => [])
    const base = await start({ listRuns })
    const response = await preflight(`${base}/api/v1/listRuns`, otherOrigin)
    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()

    // A request that needs no preflight still runs (the token guards it), but the page that
    // sent it cannot read the answer.
    const simple = await fetch(`${base}/api/v1/info`, { headers: { origin: otherOrigin } })
    expect(simple.headers.get('access-control-allow-origin')).toBeNull()
    expect(listRuns).not.toHaveBeenCalled()
  })

  it('leaves the hosted web app without CORS headers', async () => {
    const base = await start()
    const response = await fetch(`${base}/api/v1/info`)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
