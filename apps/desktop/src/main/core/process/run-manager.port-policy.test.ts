import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type PortConflict, type Script } from '@devhub/shared'
import { createHarness, project, type TestHarness } from './run-manager.fixtures'

describe('script port replacement', () => {
  let harness: TestHarness
  const occupied: PortConflict = { port: 5173, pid: 700, processName: 'node' }
  const first: Script = {
    id: 'custom:first',
    name: 'first',
    source: 'custom',
    command: 'first',
    ports: [5173]
  }
  const second: Script = { ...first, id: 'custom:second', name: 'second', command: 'second' }
  const scripts = {
    async find(_projectId: unknown, scriptId: unknown) {
      return { project, script: scriptId === first.id ? first : second }
    }
  }

  beforeEach(() => {
    harness = createHarness()
  })

  it('releases and rechecks a taken port before spawning the new service', async () => {
    let conflicts = [occupied]
    const releasePorts = vi.fn(async () => {
      expect(harness.spawned).toHaveLength(0)
      conflicts = []
    })
    const manager = harness.makeManager({
      scripts,
      portConflictPolicy: async () => 'terminate',
      portConflicts: async () => conflicts,
      releasePorts
    })
    await expect(manager.start('p1', first.id)).resolves.toMatchObject({ status: 'running' })
    expect(releasePorts).toHaveBeenCalledWith(first, [])
    expect(harness.spawned).toHaveLength(1)
  })

  it('lets an explicit script policy override the global setting', async () => {
    const releasePorts = vi.fn(async () => undefined)
    const manager = harness.makeManager({
      scripts: {
        find: async () => ({ project, script: { ...first, portConflictPolicy: 'error' } })
      },
      portConflictPolicy: async () => 'terminate',
      portConflicts: async () => [occupied],
      releasePorts
    })
    await expect(manager.start('p1', first.id)).rejects.toMatchObject({ code: 'PORT_IN_USE' })
    expect(releasePorts).not.toHaveBeenCalled()
    expect(harness.spawned).toHaveLength(0)
  })

  it('does not launch when release fails or another holder takes the port', async () => {
    const releasePorts = vi.fn(async (): Promise<void> => {
      throw new DevhubError('PORT_RELEASE_FAILED', '权限不足')
    })
    const manager = harness.makeManager({
      scripts,
      portConflictPolicy: async () => 'terminate',
      portConflicts: async () => [occupied],
      releasePorts
    })
    await expect(manager.start('p1', first.id)).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: '权限不足'
    })
    releasePorts.mockResolvedValueOnce(undefined)
    await expect(manager.start('p1', first.id)).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED'
    })
    expect(harness.spawned).toHaveLength(0)
  })

  it('reports inferred port conflicts without terminating their holders', async () => {
    const releasePorts = vi.fn(async () => undefined)
    const manager = harness.makeManager({
      scripts: {
        find: async () => ({ project, script: { ...first, portsInferred: true } })
      },
      portConflictPolicy: async () => 'terminate',
      portConflicts: async () => [occupied],
      releasePorts
    })
    await expect(manager.start('p1', first.id)).rejects.toMatchObject({ code: 'PORT_IN_USE' })
    expect(releasePorts).not.toHaveBeenCalled()
    expect(harness.spawned).toHaveLength(0)

    await expect(
      manager.start('p1', first.id, { ignorePortConflicts: true })
    ).resolves.toMatchObject({ status: 'running' })
    expect(releasePorts).not.toHaveBeenCalled()
    expect(harness.killer.interrupt).not.toHaveBeenCalled()
  })

  it('stops a managed service reserving the port before it has started listening', async () => {
    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    const manager = harness.makeManager({ scripts, portConflictPolicy: async () => 'terminate' })
    const old = await manager.start('p1', first.id)
    const next = await manager.start('p1', second.id)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: old.id, status: 'exited', stopped: true }),
      expect.objectContaining({ id: next.id, status: 'running' })
    ])
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(1)
  })

  it('does not treat a managed service guessed port as a reservation', async () => {
    const releasePorts = vi.fn(async () => undefined)
    const manager = harness.makeManager({
      scripts: {
        find: async (_projectId, scriptId) => ({
          project,
          script: scriptId === first.id ? { ...first, portsInferred: true } : second
        })
      },
      portConflictPolicy: async () => 'terminate',
      releasePorts
    })
    const old = await manager.start('p1', first.id)
    const next = await manager.start('p1', second.id)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: old.id, status: 'running' }),
      expect.objectContaining({ id: next.id, status: 'running' })
    ])
    expect(releasePorts).toHaveBeenCalledTimes(1)
    expect(releasePorts).toHaveBeenCalledWith(second, [
      expect.objectContaining({ pid: old.pid, stop: expect.any(Function) })
    ])
    expect(harness.killer.interrupt).not.toHaveBeenCalled()
  })

  it('keeps a reserved port exclusive when the default policy rejects conflicts', async () => {
    const manager = harness.makeManager({ scripts })
    await manager.start('p1', first.id)
    await expect(manager.start('p1', second.id)).rejects.toMatchObject({ code: 'PORT_IN_USE' })
    expect(harness.spawned).toHaveLength(1)
    expect(harness.killer.interrupt).not.toHaveBeenCalled()
  })

  it('serializes concurrent starts of the same script without launching duplicate processes', async () => {
    const manager = harness.makeManager({ scripts, portConflictPolicy: async () => 'terminate' })
    const result = await Promise.allSettled([
      manager.start('p1', first.id),
      manager.start('p1', first.id)
    ])
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1)
    expect(result.find((entry) => entry.status === 'rejected')).toMatchObject({
      reason: { code: 'SCRIPT_ALREADY_RUNNING' }
    })
    expect(harness.spawned).toHaveLength(1)
  })

  it('serializes different services sharing a port and replaces the first managed reservation', async () => {
    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    const manager = harness.makeManager({ scripts, portConflictPolicy: async () => 'terminate' })
    await Promise.all([manager.start('p1', first.id), manager.start('p1', second.id)])
    expect(manager.list()).toEqual([
      expect.objectContaining({ title: first.name, status: 'exited', stopped: true }),
      expect.objectContaining({ title: second.name, status: 'running' })
    ])
  })

  it('still applies automatic replacement when restarting a managed service', async () => {
    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    const releasePorts = vi.fn(async () => undefined)
    const manager = harness.makeManager({
      scripts,
      portConflictPolicy: async () => 'terminate',
      releasePorts
    })
    const run = await manager.start('p1', first.id)
    await manager.restart(run.id)
    expect(releasePorts).toHaveBeenCalledTimes(2)
    expect(manager.list()).toHaveLength(1)
    expect(manager.list()[0]?.status).toBe('running')
  })

  it('does not launch after shutdown begins while preparing a port replacement', async () => {
    let finishRelease = (): void => undefined
    let releaseStarted = (): void => undefined
    const started = new Promise<void>((resolve) => {
      releaseStarted = resolve
    })
    const manager = harness.makeManager({
      scripts,
      portConflictPolicy: async () => 'terminate',
      releasePorts: () =>
        new Promise<void>((resolve) => {
          finishRelease = resolve
          releaseStarted()
        })
    })
    const starting = manager.start('p1', first.id)
    await started
    const rejected = expect(starting).rejects.toMatchObject({ code: 'SPAWN_FAILED' })
    const disposing = manager.dispose()
    finishRelease()
    await Promise.all([rejected, disposing])
    expect(harness.spawned).toHaveLength(0)
  })
})
