import { createServer } from 'net'
import { describe, expect, it, vi } from 'vitest'
import type { DevhubApi } from '@devhub/shared'
import type { RemoteConfig } from './remote-config'
import { createRemoteHost } from './remote-host'

const token = 'x'.repeat(43)
const api = { listRuns: async () => [] } as Partial<DevhubApi> as DevhubApi
const silent = { info: vi.fn(), error: vi.fn() }

/** A port that was free a moment ago. */
const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })

const config = (overrides: Partial<RemoteConfig>): RemoteConfig => ({
  enabled: true,
  host: '127.0.0.1',
  port: 0,
  allowTerminal: false,
  token,
  ...overrides
})

const listRuns = (port: number): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/api/v1/listRuns`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  })

describe('remote host', () => {
  it('serves the api while enabled and stops on dispose', async () => {
    const port = await freePort()
    const host = createRemoteHost({
      api,
      config: { get: async () => config({ port }) },
      log: silent
    })
    await host.start()
    expect(await (await listRuns(port)).json()).toEqual({ ok: true, value: [] })
    await host.dispose()
    await expect(listRuns(port)).rejects.toThrow()
  })

  it('does not listen when disabled', async () => {
    const port = await freePort()
    const host = createRemoteHost({
      api,
      config: { get: async () => config({ enabled: false, port }) },
      log: silent
    })
    await host.start()
    await expect(listRuns(port)).rejects.toThrow()
    await host.dispose()
  })

  it('logs instead of throwing when it cannot start', async () => {
    const log = { info: vi.fn(), error: vi.fn() }
    const host = createRemoteHost({
      api,
      config: {
        get: async () => {
          throw new Error('unreadable')
        }
      },
      log
    })
    await expect(host.start()).resolves.toBeUndefined()
    expect(log.error).toHaveBeenCalled()
    await host.dispose()
  })

  it('waits for a pending start before disposing', async () => {
    const port = await freePort()
    const host = createRemoteHost({
      api,
      config: { get: async () => config({ port }) },
      log: silent
    })
    void host.start()
    await host.dispose()
    await expect(listRuns(port)).rejects.toThrow()
  })
})
