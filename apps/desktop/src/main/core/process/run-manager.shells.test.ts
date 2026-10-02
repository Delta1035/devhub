import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHarness, type TestHarness } from './run-manager.fixtures'

describe('createRunManager shells', () => {
  let harness: TestHarness

  beforeEach(() => {
    vi.useFakeTimers()
    harness = createHarness()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the default shell in the project directory', async () => {
    const manager = harness.makeManager()
    const run = await manager.startShell('p1')
    expect(run).toMatchObject({
      kind: 'shell',
      shellId: 'bash',
      title: '终端 1',
      command: '/bin/bash',
      status: 'running'
    })
    expect(harness.spawned[0]).toEqual({
      file: '/bin/bash',
      args: ['-l'],
      cwd: '/repo',
      env: { PATH: '/bin' }
    })
  })

  it('opens a chosen shell with its own environment, after preparing it', async () => {
    const manager = harness.makeManager()
    const run = await manager.startShell('p1', 'zsh')
    expect(run).toMatchObject({ shellId: 'zsh', command: '/usr/bin/zsh' })
    expect(harness.spawned[0]?.env).toEqual({ PATH: '/bin', ZDOTDIR: '/z' })
    expect(harness.prepareShell).toHaveBeenCalledWith(expect.objectContaining({ id: 'zsh' }))
  })

  it.each([
    ['an unknown shell id', 'notepad', 'INVALID_INPUT'],
    ['a shell that is not installed', 'fish', 'SHELL_NOT_FOUND']
  ])('rejects %s', async (_label, shellId, code) => {
    await expect(harness.makeManager().startShell('p1', shellId)).rejects.toMatchObject({ code })
    expect(harness.spawned).toEqual([])
  })

  it('reports when no shell is installed at all', async () => {
    const manager = harness.makeManager({
      shells: { list: async () => [], prepare: async () => undefined }
    })
    await expect(manager.startShell('p1')).rejects.toMatchObject({ code: 'SHELL_NOT_FOUND' })
  })

  it('refuses to open a shell in a directory that no longer exists', async () => {
    const manager = harness.makeManager({ isDirectory: async () => false })
    await expect(manager.startShell('p1')).rejects.toMatchObject({
      code: 'PROJECT_PATH_NOT_FOUND'
    })
  })

  it('wraps a failure to write the startup file', async () => {
    harness.prepareShell.mockRejectedValueOnce(new Error('EACCES'))
    await expect(harness.makeManager().startShell('p1')).rejects.toMatchObject({
      code: 'SPAWN_FAILED'
    })
  })

  it('allows several shells per project and reuses the lowest free number', async () => {
    const manager = harness.makeManager()
    const first = await manager.startShell('p1')
    const second = await manager.startShell('p1')
    expect([first.title, second.title]).toEqual(['终端 1', '终端 2'])

    harness.ptys[0]?.emitExit(0)
    manager.remove(first.id)
    await expect(manager.startShell('p1')).resolves.toMatchObject({ title: '终端 1' })
  })

  it('hangs up a shell instead of sending Ctrl+C when stopping it', async () => {
    const manager = harness.makeManager()
    const run = await manager.startShell('p1')
    const stopping = manager.stop(run.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.killer.hangup).toHaveBeenCalledWith(harness.ptys[0])
    expect(harness.killer.interrupt).not.toHaveBeenCalled()

    harness.ptys[0]?.emitExit(129)
    await stopping
    expect(manager.list()[0]).toMatchObject({ status: 'exited', stopped: true })
  })

  it('force-kills a shell whose tree ignores the hang-up', async () => {
    const manager = harness.makeManager()
    const run = await manager.startShell('p1')
    const stopping = manager.stop(run.id)
    await vi.advanceTimersByTimeAsync(1000)
    expect(harness.killer.forceKill).toHaveBeenCalledWith(run.pid)
    harness.ptys[0]?.emitExit(137)
    await stopping
  })

  it('restarts a shell as a fresh shell of the same kind', async () => {
    const manager = harness.makeManager()
    const run = await manager.startShell('p1', 'zsh')
    const restarting = manager.restart(run.id)
    await vi.advanceTimersByTimeAsync(0)
    harness.ptys[0]?.emitExit(0)
    await expect(restarting).resolves.toMatchObject({ kind: 'shell', shellId: 'zsh' })
  })

  it('stops shells together with scripts on dispose', async () => {
    const manager = harness.makeManager()
    await manager.start('p1', 'npm:dev')
    await manager.startShell('p1')
    const disposing = manager.dispose()
    await vi.advanceTimersByTimeAsync(0)
    for (const pty of harness.ptys) pty.emitExit(0)
    await disposing
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(1)
    expect(harness.killer.hangup).toHaveBeenCalledTimes(1)
  })
})
