import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type DevhubApi } from '@devhub/shared'
import { createFailureLimiter } from './auth'
import { startRemoteServer, type RemoteServer, type RemoteServerOptions } from './remote-server'

const token = 'x'.repeat(43)

/** Only the methods a test calls, with simplified results; the server never inspects them. */
const fakeApi = (methods: Record<string, unknown>): DevhubApi => methods as unknown as DevhubApi

describe('remote server', () => {
  let server: RemoteServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  const start = async (options: Partial<RemoteServerOptions> = {}): Promise<string> => {
    server = await startRemoteServer({
      api: fakeApi({}),
      subscribe: () => () => undefined,
      host: '127.0.0.1',
      port: 0,
      token,
      allowTerminal: false,
      ...options
    })
    return `http://127.0.0.1:${server.port}`
  }

  const call = (
    base: string,
    method: string,
    body: unknown = { args: [] },
    headers: Record<string, string> = {}
  ): Promise<Response> =>
    fetch(`${base}/api/v1/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })

  const errorCode = async (response: Response): Promise<string> =>
    ((await response.json()) as { error: { code: string } }).error.code

  it('answers info without a token', async () => {
    const base = await start()
    const response = await fetch(`${base}/api/v1/info`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ protocol: 1 })
  })

  it('calls the method with the given arguments and returns the IPC envelope', async () => {
    const listScripts = vi.fn(async (projectId: string) => ({ projectId }))
    const base = await start({ api: fakeApi({ listScripts }) })
    const response = await call(base, 'listScripts', { args: ['p1'] })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ ok: true, value: { projectId: 'p1' } })
    expect(listScripts).toHaveBeenCalledWith('p1')
  })

  it('treats missing args as none', async () => {
    const listRuns = vi.fn(async () => [])
    const base = await start({ api: fakeApi({ listRuns }) })
    expect(await (await call(base, 'listRuns', {})).json()).toEqual({ ok: true, value: [] })
    expect(listRuns).toHaveBeenCalledWith()
  })

  it('keeps the code of expected failures and hides unexpected ones', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const base = await start({
      api: fakeApi({
        stopRun: async () => {
          throw new DevhubError('RUN_NOT_FOUND', '运行不存在')
        },
        listRuns: async () => {
          throw new Error('boom')
        }
      })
    })
    expect(await (await call(base, 'stopRun', { args: ['r'] })).json()).toEqual({
      ok: false,
      error: { code: 'RUN_NOT_FOUND', message: '运行不存在' }
    })
    expect(await errorCode(await call(base, 'listRuns'))).toBe('INTERNAL')
  })

  it.each([
    ['no token', {}],
    ['a wrong token', { authorization: 'Bearer wrong' }],
    ['another scheme', { authorization: `Basic ${token}` }]
  ])('rejects %s', async (_case, headers) => {
    const listRuns = vi.fn(async () => [])
    const base = await start({ api: fakeApi({ listRuns }) })
    const response = await fetch(`${base}/api/v1/listRuns`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{}'
    })
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    expect(await errorCode(response)).toBe('UNAUTHORIZED')
    expect(listRuns).not.toHaveBeenCalled()
  })

  it('locks out an address after repeated failures, even with the right token', async () => {
    const listRuns = vi.fn(async () => [])
    const base = await start({
      api: fakeApi({ listRuns }),
      limiter: createFailureLimiter({ maxFailures: 2 })
    })
    for (let i = 0; i < 2; i++) {
      expect((await call(base, 'listRuns', {}, { authorization: 'Bearer wrong' })).status).toBe(401)
    }
    const response = await call(base, 'listRuns')
    expect(response.status).toBe(429)
    expect(listRuns).not.toHaveBeenCalled()
  })

  it('never runs local methods, and terminal methods only when allowed', async () => {
    const updateSettings = vi.fn()
    const startShell = vi.fn(async () => ({ id: 'r' }))
    const api = fakeApi({ updateSettings, startShell })

    let base = await start({ api })
    expect((await call(base, 'updateSettings', { args: [{}] })).status).toBe(403)
    const denied = await call(base, 'startShell', { args: ['p'] })
    expect(denied.status).toBe(403)
    expect(await errorCode(denied)).toBe('FORBIDDEN')
    await server!.close()

    base = await start({ api, allowTerminal: true })
    expect((await call(base, 'updateSettings', { args: [{}] })).status).toBe(403)
    expect((await call(base, 'startShell', { args: ['p'] })).status).toBe(200)
    expect(updateSettings).not.toHaveBeenCalled()
    expect(startShell).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['an unknown method', 'deleteEverything', 'POST', 404],
    ['an inherited property', 'constructor', 'POST', 404],
    ['a path outside the API', '../../etc', 'POST', 404],
    ['GET on a method', 'listRuns', 'GET', 405]
  ])('rejects %s', async (_case, method, verb, status) => {
    const base = await start({ api: fakeApi({ listRuns: async () => [] }) })
    const response = await fetch(`${base}/api/v1/${method}`, {
      method: verb,
      headers: { authorization: `Bearer ${token}` }
    })
    expect(response.status).toBe(status)
  })

  it.each([
    ['a non-JSON content type', 'text/plain', '{}', 415],
    ['malformed JSON', 'application/json', '{', 400],
    ['args that are not an array', 'application/json', '{"args":"p1"}', 400],
    ['too many args', 'application/json', JSON.stringify({ args: Array(9).fill(0) }), 400]
  ])('rejects %s', async (_case, contentType, body, status) => {
    const listRuns = vi.fn(async () => [])
    const base = await start({ api: fakeApi({ listRuns }) })
    const response = await call(base, 'listRuns', body, { 'content-type': contentType })
    expect(response.status).toBe(status)
    expect(listRuns).not.toHaveBeenCalled()
  })

  it('rejects a body over the limit', async () => {
    const getRunOutput = vi.fn()
    const base = await start({ api: fakeApi({ getRunOutput }), maxBodyBytes: 100 })
    const response = await call(base, 'getRunOutput', { args: ['r'.repeat(200)] })
    expect(response.status).toBe(413)
    expect(getRunOutput).not.toHaveBeenCalled()
  })

  it('stops accepting connections once closed', async () => {
    const base = await start()
    await server!.close()
    server = undefined
    await expect(fetch(`${base}/api/v1/info`)).rejects.toThrow()
  })

  it('fails to start when the port is taken', async () => {
    await start()
    await expect(
      startRemoteServer({
        api: fakeApi({}),
        subscribe: () => () => undefined,
        host: '127.0.0.1',
        port: server!.port,
        token,
        allowTerminal: false
      })
    ).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})
