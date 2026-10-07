import { createServer, type Server } from 'net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevhubApi, NetworkAddress } from '@devhub/shared'
import type { RemoteConfig, RemoteConfigStore } from './remote-config'
import { createRemoteHost, type RemoteHost } from './remote-host'

const api = { listRuns: async () => [] } as Partial<DevhubApi> as DevhubApi
const subscribe = () => () => undefined
const silent = { info: vi.fn(), error: vi.fn() }
const lan: NetworkAddress = {
  address: '192.168.1.5',
  family: 'IPv4',
  interfaceName: 'eth0',
  tailscale: false,
  virtual: false
}

/** A port that was free a moment ago. */
const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })

/** In-memory stand-in for remote.json. */
function memoryConfig(initial: Partial<RemoteConfig>): RemoteConfigStore & { value: RemoteConfig } {
  let tokens = 0
  const store = {
    value: {
      enabled: true,
      host: '127.0.0.1',
      port: 0,
      allowTerminal: false,
      token: 'token-0'.padEnd(43, 'x'),
      ...initial
    },
    isEnabled: async () => store.value.enabled,
    get: async () => ({ ...store.value }),
    update: async (change: Partial<RemoteConfig>) => {
      store.value = { ...store.value, ...change }
      return { ...store.value }
    },
    regenerateToken: async () => {
      store.value = { ...store.value, token: `token-${++tokens}`.padEnd(43, 'x') }
      return { ...store.value }
    }
  }
  return store
}

const listRuns = (port: number, token: string): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/api/v1/listRuns`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  })

describe('remote host', () => {
  let host: RemoteHost | undefined
  let blocker: Server | undefined

  afterEach(async () => {
    await host?.dispose()
    host = undefined
    await new Promise((resolve) => (blocker ? blocker.close(resolve) : resolve(undefined)))
    blocker = undefined
  })

  const create = (config: RemoteConfigStore, busyPortRetryDelaysMs: number[] = []): RemoteHost =>
    (host = createRemoteHost({
      api,
      subscribe,
      config,
      addresses: () => [lan],
      appVersion: '1.2.3',
      busyPortRetryDelaysMs,
      log: silent
    }))

  /** Holds a port, as the previous DevHub does while it stops its runs after an update. */
  const occupy = async (): Promise<number> => {
    const port = await freePort()
    blocker = createServer()
    await new Promise<void>((resolve) => blocker!.listen(port, '127.0.0.1', resolve))
    return port
  }
  const release = (): Promise<void> =>
    new Promise((resolve) => {
      blocker!.close(() => resolve())
      blocker = undefined
    })

  it('serves the api while enabled and reports where it listens', async () => {
    const port = await freePort()
    const config = memoryConfig({ port })
    await create(config).start()
    expect(await (await listRuns(port, config.value.token)).json()).toEqual({ ok: true, value: [] })
    expect(await host!.state()).toMatchObject({
      enabled: true,
      status: { state: 'listening', port },
      addresses: [lan]
    })
    await host!.dispose()
    await expect(listRuns(port, config.value.token)).rejects.toThrow()
  })

  it('does not listen while disabled, and starts once enabled', async () => {
    const port = await freePort()
    const config = memoryConfig({ enabled: false, port })
    await create(config).start()
    expect((await host!.state()).status).toEqual({ state: 'off' })
    await expect(listRuns(port, config.value.token)).rejects.toThrow()

    const state = await host!.update({ enabled: true })
    expect(state.status).toEqual({ state: 'listening', port })
    expect((await listRuns(port, config.value.token)).status).toBe(200)

    await host!.update({ enabled: false })
    await expect(listRuns(port, config.value.token)).rejects.toThrow()
  })

  it('reports a taken port as the status', async () => {
    const port = await freePort()
    blocker = createServer()
    await new Promise<void>((resolve) => blocker!.listen(port, '127.0.0.1', resolve))
    await create(memoryConfig({ port })).start()
    expect((await host!.state()).status).toEqual({
      state: 'error',
      message: `端口 ${port} 已被占用`
    })
  })

  it('waits at startup for a port the previous DevHub still holds', async () => {
    const port = await occupy()
    await create(memoryConfig({ port }), [20, 20, 20, 20, 20]).start()
    expect((await host!.state()).status).toEqual({
      state: 'error',
      message: `端口 ${port} 已被占用，正在重试…`
    })
    await release()
    await vi.waitFor(async () =>
      expect((await host!.state()).status).toEqual({ state: 'listening', port })
    )
    expect((await listRuns(port, 'token-0'.padEnd(43, 'x'))).status).toBe(200)
  })

  it('reports a port that stays taken once the retries run out', async () => {
    const port = await occupy()
    await create(memoryConfig({ port }), [10, 10]).start()
    await vi.waitFor(async () =>
      expect((await host!.state()).status).toEqual({
        state: 'error',
        message: `端口 ${port} 已被占用`
      })
    )
  })

  it('drops a pending retry when the settings change', async () => {
    const port = await occupy()
    const config = memoryConfig({ port })
    await create(config, [30]).start()
    const other = await freePort()
    expect((await host!.update({ port: other })).status).toEqual({
      state: 'listening',
      port: other
    })
    await release()
    await new Promise((resolve) => setTimeout(resolve, 80))
    // The old retry did not move the server back to the first port.
    expect((await host!.state()).status).toEqual({ state: 'listening', port: other })
    await expect(fetch(`http://127.0.0.1:${port}/api/v1/info`)).rejects.toThrow()
  })

  it('a new token replaces the old one at once', async () => {
    const port = await freePort()
    const config = memoryConfig({ port })
    await create(config).start()
    const oldToken = config.value.token
    const state = await host!.regenerateToken()
    expect(state.token).not.toBe(oldToken)
    expect((await listRuns(port, oldToken)).status).toBe(401)
    expect((await listRuns(port, state.token)).status).toBe(200)
  })

  it.each([
    [{ port: 80 }, '远程访问设置无效'],
    [{ token: 'mine' }, '远程访问设置无效'],
    [{ host: '8.8.8.8' }, '8.8.8.8 不是这台电脑的地址']
  ])('rejects %o', async (patch, message) => {
    const config = memoryConfig({ enabled: false })
    await create(config).start()
    await expect(host!.update(patch)).rejects.toMatchObject({ code: 'INVALID_INPUT', message })
  })

  it('accepts its own addresses, loopback and every interface', async () => {
    const config = memoryConfig({ enabled: false })
    await create(config).start()
    for (const address of ['192.168.1.5', '0.0.0.0', '127.0.0.1']) {
      expect((await host!.update({ host: address })).host).toBe(address)
    }
  })

  it('reports unreadable settings instead of throwing', async () => {
    const config = memoryConfig({})
    config.get = async () => {
      throw new Error('unreadable')
    }
    await expect(create(config).start()).resolves.toBeUndefined()
  })

  it('stays stopped after dispose, even if a change arrives late', async () => {
    const port = await freePort()
    const config = memoryConfig({ enabled: false, port })
    await create(config).start()
    await host!.dispose()
    await host!.update({ enabled: true })
    await expect(listRuns(port, config.value.token)).rejects.toThrow()
  })
})
