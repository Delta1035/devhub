import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortConflict } from '@devhub/shared'
import { createHarness, type TestHarness } from './run-manager.fixtures'

describe('createRunManager port conflicts', () => {
  let harness: TestHarness
  const taken: PortConflict = { port: 5173, pid: 42, processName: 'node.exe' }

  beforeEach(() => {
    vi.useFakeTimers()
    harness = createHarness()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses to start a script whose port is taken, naming the holder', async () => {
    const manager = harness.makeManager({ portConflicts: async () => [taken] })
    await expect(manager.start('p1', 'npm:dev')).rejects.toMatchObject({
      code: 'PORT_IN_USE',
      message: '无法启动 dev：端口 5173 已被 node.exe（PID 42）占用'
    })
    expect(harness.spawned).toEqual([])
  })

  it('starts anyway when the user chose to ignore the conflict', async () => {
    const manager = harness.makeManager({ portConflicts: async () => [taken] })
    await expect(
      manager.start('p1', 'npm:dev', { ignorePortConflicts: true })
    ).resolves.toMatchObject({ status: 'running' })
  })

  it('keeps the previous exited run when the start is refused', async () => {
    let conflicts: PortConflict[] = []
    const manager = harness.makeManager({ portConflicts: async () => conflicts })
    const first = await manager.start('p1', 'npm:dev')
    harness.ptys[0]?.emitExit(0)
    conflicts = [taken]
    await expect(manager.start('p1', 'npm:dev')).rejects.toMatchObject({ code: 'PORT_IN_USE' })
    expect(manager.list().map((run) => run.id)).toEqual([first.id])
  })

  it('reports "already running" before checking ports', async () => {
    const portConflicts = vi.fn(async () => [taken])
    const manager = harness.makeManager({ portConflicts })
    await manager.start('p1', 'npm:dev', { ignorePortConflicts: true })
    await expect(manager.start('p1', 'npm:dev')).rejects.toMatchObject({
      code: 'SCRIPT_ALREADY_RUNNING'
    })
    expect(portConflicts).not.toHaveBeenCalled()
  })

  it('restart does not trip over the port its own run just released', async () => {
    const manager = harness.makeManager({ portConflicts: async () => [taken] })
    const run = await manager.start('p1', 'npm:dev', { ignorePortConflicts: true })
    const restarting = manager.restart(run.id)
    harness.ptys[0]?.emitExit(0)
    await expect(restarting).resolves.toMatchObject({ status: 'running' })
  })

  it('rejects malformed options', async () => {
    await expect(
      harness.makeManager().start('p1', 'npm:dev', { ignorePortConflicts: 'yes' })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})
