import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { DevhubError, type Project, type Script } from '@devhub/shared'
import type { ProcessKiller } from './process-killer'
import type { PtyProcess, PtySpawnOptions } from './pty'
import { createRunManager, type RunManagerDeps } from './run-manager'

class FakePty implements PtyProcess {
  written: string[] = []
  private dataListeners: ((data: string) => void)[] = []
  private exitListeners: ((exitCode: number) => void)[] = []

  constructor(readonly pid: number) {}

  onData(listener: (data: string) => void): void {
    this.dataListeners.push(listener)
  }
  onExit(listener: (exitCode: number) => void): void {
    this.exitListeners.push(listener)
  }
  write(data: string): void {
    this.written.push(data)
  }
  emitData(data: string): void {
    for (const listener of this.dataListeners) listener(data)
  }
  emitExit(exitCode: number): void {
    for (const listener of this.exitListeners) listener(exitCode)
  }
}

const project: Project = {
  id: 'p1',
  name: 'web',
  path: '/repo',
  addedAt: '2026-10-02T00:00:00.000Z'
}
const scriptsById: Record<string, Script> = {
  'npm:dev': { id: 'npm:dev', name: 'dev', source: 'npm', command: 'pnpm run dev' },
  'npm:api': { id: 'npm:api', name: 'api', source: 'npm', command: 'pnpm run api', cwd: 'server' }
}

describe('createRunManager', () => {
  let ptys: FakePty[]
  let spawned: PtySpawnOptions[]
  let killer: {
    interrupt: Mock<ProcessKiller['interrupt']>
    forceKill: Mock<ProcessKiller['forceKill']>
  }
  let nextPid: number
  let nextId: number

  beforeEach(() => {
    vi.useFakeTimers()
    ptys = []
    spawned = []
    nextPid = 100
    nextId = 0
    killer = {
      interrupt: vi.fn<ProcessKiller['interrupt']>(),
      forceKill: vi.fn<ProcessKiller['forceKill']>(async () => undefined)
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeManager = (overrides: Partial<RunManagerDeps> = {}) =>
    createRunManager({
      scripts: {
        async find(projectId, scriptId) {
          const script = typeof scriptId === 'string' ? scriptsById[scriptId] : undefined
          if (projectId !== 'p1' || !script) throw new DevhubError('SCRIPT_NOT_FOUND', 'nope')
          return { project, script }
        }
      },
      spawn: (options) => {
        spawned.push(options)
        const pty = new FakePty(nextPid++)
        ptys.push(pty)
        return pty
      },
      killer,
      platform: 'linux',
      env: { PATH: '/bin', EMPTY: undefined },
      graceMs: 1000,
      forceTimeoutMs: 500,
      outputLimit: 10,
      now: () => new Date('2026-10-02T12:00:00.000Z'),
      newId: () => `run-${++nextId}`,
      ...overrides
    })

  it('spawns the resolved command in the project directory', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    expect(run).toEqual({
      id: 'run-1',
      projectId: 'p1',
      scriptId: 'npm:dev',
      scriptName: 'dev',
      command: 'pnpm run dev',
      status: 'running',
      pid: 100,
      exitCode: null,
      stopped: false,
      startedAt: '2026-10-02T12:00:00.000Z'
    })
    expect(spawned[0]).toEqual({
      command: 'pnpm run dev',
      cwd: '/repo',
      env: { PATH: '/bin' },
      platform: 'linux'
    })
    expect(manager.list()).toEqual([run])
  })

  it('resolves a script cwd relative to the project', async () => {
    await makeManager().start('p1', 'npm:api')
    expect(spawned[0]?.cwd).toMatch(/repo[\\/]server$/)
  })

  it('propagates script lookup errors', async () => {
    await expect(makeManager().start('p1', 'npm:nope')).rejects.toMatchObject({
      code: 'SCRIPT_NOT_FOUND'
    })
  })

  it('wraps spawn failures', async () => {
    const manager = makeManager({
      spawn: () => {
        throw new Error('ENOENT')
      }
    })
    await expect(manager.start('p1', 'npm:dev')).rejects.toMatchObject({
      code: 'SPAWN_FAILED',
      message: '无法启动 dev：ENOENT'
    })
  })

  it('rejects starting a script that is already running', async () => {
    const manager = makeManager()
    await manager.start('p1', 'npm:dev')
    await expect(manager.start('p1', 'npm:dev')).rejects.toMatchObject({
      code: 'SCRIPT_ALREADY_RUNNING'
    })
  })

  it('records the exit code when the process exits on its own', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    ptys[0]?.emitExit(1)
    expect(manager.list()).toEqual([
      { ...run, status: 'exited', exitCode: 1, endedAt: '2026-10-02T12:00:00.000Z' }
    ])
  })

  it('replaces the exited run when the script starts again', async () => {
    const manager = makeManager()
    await manager.start('p1', 'npm:dev')
    ptys[0]?.emitExit(0)
    const second = await manager.start('p1', 'npm:dev')
    expect(manager.list()).toEqual([second])
  })

  it('keeps only the most recent output up to the limit', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    ptys[0]?.emitData('hello ')
    ptys[0]?.emitData('world!')
    expect(manager.output(run.id)).toBe('llo world!')
  })

  it('stops gracefully when the process exits after the interrupt', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopping = manager.stop(run.id)
    expect(killer.interrupt).toHaveBeenCalledWith(ptys[0])
    expect(manager.list()[0]).toMatchObject({ status: 'stopping', stopped: true })

    ptys[0]?.emitExit(130)
    await stopping
    expect(killer.forceKill).not.toHaveBeenCalled()
    expect(manager.list()[0]).toMatchObject({ status: 'exited', exitCode: 130, stopped: true })
  })

  it('force-kills the tree when the grace period runs out', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopping = manager.stop(run.id)
    await vi.advanceTimersByTimeAsync(1000)
    expect(killer.forceKill).toHaveBeenCalledWith(100)

    ptys[0]?.emitExit(1)
    await stopping
    expect(manager.list()[0]?.status).toBe('exited')
  })

  it('marks the run exited if no exit event arrives after the forced kill', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopping = manager.stop(run.id)
    await vi.advanceTimersByTimeAsync(1500)
    await stopping
    expect(manager.list()[0]).toMatchObject({ status: 'exited', exitCode: null })
  })

  it('lets concurrent stop calls share one shutdown', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const first = manager.stop(run.id)
    const second = manager.stop(run.id)
    ptys[0]?.emitExit(0)
    await Promise.all([first, second])
    expect(killer.interrupt).toHaveBeenCalledTimes(1)
  })

  it('treats stopping an exited run as a no-op', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    ptys[0]?.emitExit(0)
    await manager.stop(run.id)
    expect(killer.interrupt).not.toHaveBeenCalled()
  })

  it('restarts by stopping and starting the same script', async () => {
    const manager = makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const restarting = manager.restart(run.id)
    ptys[0]?.emitExit(0)
    const restarted = await restarting
    expect(restarted).toMatchObject({ id: 'run-2', scriptId: 'npm:dev', pid: 101 })
    expect(manager.list()).toEqual([restarted])
  })

  it('stops every active run on dispose', async () => {
    const manager = makeManager()
    await manager.start('p1', 'npm:dev')
    await manager.start('p1', 'npm:api')
    const disposing = manager.dispose()
    for (const pty of ptys) pty.emitExit(0)
    await disposing
    expect(killer.interrupt).toHaveBeenCalledTimes(2)
    expect(manager.list().every((run) => run.status === 'exited')).toBe(true)
  })

  it.each([['unknown'], [42]])('rejects unknown run id %s', async (runId) => {
    const manager = makeManager()
    await expect(manager.stop(runId)).rejects.toMatchObject({ code: 'RUN_NOT_FOUND' })
    await expect(manager.restart(runId)).rejects.toMatchObject({ code: 'RUN_NOT_FOUND' })
    expect(() => manager.output(runId)).toThrow(DevhubError)
  })
})
