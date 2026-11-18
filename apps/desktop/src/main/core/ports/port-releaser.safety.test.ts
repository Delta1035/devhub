import { describe, expect, it, vi } from 'vitest'
import { createPortReleaser, type PortReleaserDeps } from './port-releaser'
import type { PortProcess } from './port-processes'

const fixture = (overrides: Partial<PortReleaserDeps> = {}) => {
  const rows = new Map<number, PortProcess>(
    [
      { pid: 1, parentPid: 0, identity: 'init' },
      { pid: 800, parentPid: 1, identity: 'ancestor' },
      { pid: 900, parentPid: 800, identity: 'self' },
      { pid: 42, parentPid: 1, identity: 'listener' }
    ].map((row) => [row.pid, row])
  )
  const kill = vi.fn<(pid: number, signal: NodeJS.Signals) => void>((pid) => {
    rows.delete(pid)
  })
  const findOwners = vi.fn(async () => (rows.has(42) ? [{ pid: 42, name: 'listener' }] : []))
  const release = createPortReleaser({
    platform: 'linux',
    selfPid: 900,
    readProcesses: async () => [...rows.values()],
    findOwners,
    isPortInUse: async () => rows.has(42),
    kill,
    graceMs: 10,
    forceTimeoutMs: 20,
    pollMs: 1,
    ...overrides
  })
  return { release, rows, kill, findOwners }
}

describe('port release failures and ownership', () => {
  it('does no OS work for scripts without ports', async () => {
    const { release, findOwners, kill } = fixture()
    await release({})
    await release({ ports: [] })
    expect(findOwners).not.toHaveBeenCalled()
    expect(kill).not.toHaveBeenCalled()
  })

  it('releases all reported listeners once, even with duplicate requested ports', async () => {
    const { release, rows, kill, findOwners } = fixture()
    rows.set(43, { pid: 43, parentPid: 1, identity: 'second listener' })
    findOwners.mockImplementation(async () =>
      [42, 43].filter((pid) => rows.has(pid)).map((pid) => ({ pid, name: 'listener' }))
    )
    await release({ ports: [5173, 5173] })
    expect(kill.mock.calls).toEqual([
      [42, 'SIGTERM'],
      [43, 'SIGTERM']
    ])
    expect(rows.has(42)).toBe(false)
    expect(rows.has(43)).toBe(false)
  })

  it('refuses a busy port with unknown owners instead of starting anyway', async () => {
    const { release, kill } = fixture({ findOwners: async () => [] })
    await expect(release({ ports: [5173] })).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('无法确定端口 5173')
    })
    expect(kill).not.toHaveBeenCalled()
  })

  it('checks every requested port before terminating any process', async () => {
    const { release, kill } = fixture({
      findOwners: async (port) => {
        if (port === 5174) throw new Error('监听者信息不可见')
        return [{ pid: 42, name: 'listener' }]
      }
    })
    await expect(release({ ports: [5173, 5174] })).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('监听者信息不可见')
    })
    expect(kill).not.toHaveBeenCalled()
  })

  it.each([1, 800, 900])('protects system, app and ancestor PID %i', async (pid) => {
    const { release, kill } = fixture({ findOwners: async () => [{ pid, name: 'protected' }] })
    await expect(release({ ports: [5173] })).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('受保护')
    })
    expect(kill).not.toHaveBeenCalled()
  })

  it('refuses an owner with no verifiable creation time', async () => {
    const { release, rows, kill } = fixture()
    rows.set(42, { pid: 42, parentPid: 1, identity: null })
    await expect(release({ ports: [5173] })).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('无法核验')
    })
    expect(kill).not.toHaveBeenCalled()
  })

  it('propagates permission failures without claiming a successful release', async () => {
    const kill = vi.fn(() => {
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' })
    })
    await expect(fixture({ kill }).release({ ports: [5173] })).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('EPERM')
    })
    expect(kill).toHaveBeenCalledTimes(1)
  })

  it('fails if a managed stop finishes without releasing the port', async () => {
    const { release, kill } = fixture()
    const stop = vi.fn(async () => undefined)
    await expect(release({ ports: [5173] }, [{ pid: 42, stop }])).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('释放超时')
    })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(kill).not.toHaveBeenCalled()
  })

  it('refuses a newly arrived owner instead of chasing and killing it', async () => {
    const { release, rows, kill, findOwners } = fixture()
    findOwners.mockImplementation(async () => {
      const pid = rows.has(42) ? 42 : 77
      return [{ pid, name: 'listener' }]
    })
    const stop = vi.fn(async () => {
      rows.delete(42)
      rows.set(77, { pid: 77, parentPid: 1, identity: 'new listener' })
    })
    await expect(release({ ports: [5173] }, [{ pid: 42, stop }])).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('新进程 PID 77 再次占用')
    })
    expect(rows.has(77)).toBe(true)
    expect(kill).not.toHaveBeenCalled()
  })

  it('does not call the managed stop callback after the root PID is reused', async () => {
    let call = 0
    const snapshots: PortProcess[] = [
      { pid: 900, parentPid: 0, identity: 'self' },
      { pid: 42, parentPid: 0, identity: 'listener' }
    ]
    const { release, kill } = fixture({
      readProcesses: async () =>
        snapshots.map((row) =>
          row.pid === 42 && call++ > 0 ? { ...row, identity: 'new process' } : row
        )
    })
    const stop = vi.fn(async () => undefined)
    await expect(release({ ports: [5173] }, [{ pid: 42, stop }])).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('身份已变化')
    })
    expect(stop).not.toHaveBeenCalled()
    expect(kill).not.toHaveBeenCalled()
  })

  it('reads the current grace setting for each release', async () => {
    const graceMs = vi.fn(() => 0)
    const { release, rows } = fixture({ graceMs })
    await release({ ports: [5173] })
    rows.set(42, { pid: 42, parentPid: 1, identity: 'next listener' })
    graceMs.mockReturnValue(50)
    await release({ ports: [5173] })
    expect(graceMs).toHaveBeenCalledTimes(2)
  })
})
