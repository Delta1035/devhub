import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DevhubError,
  type ContinueCondition,
  type DevhubEvent,
  type Group,
  type GroupRunState,
  type Run
} from '@devhub/shared'
import { createGroupRunner } from './group-runner'

/** A minimal in-memory RunManager: runs start "running" and are driven by the test. */
const fakeRuns = (emit: (event: DevhubEvent) => void) => {
  const runs: Run[] = []
  const outputs = new Map<string, string>()
  let next = 0
  const update = (run: Run, changes: Partial<Run>): void => {
    Object.assign(run, changes)
    emit({ type: 'run-updated', run: { ...run } })
  }
  return {
    runs,
    failToStart: new Set<string>(),
    start: vi.fn(async (projectId: unknown, scriptId: unknown) => {
      if (typeof scriptId !== 'string' || typeof projectId !== 'string') throw new Error('bad')
      if (manager.failToStart.has(scriptId)) {
        throw new DevhubError('SCRIPT_NOT_FOUND', '脚本不存在，可能已从项目中删除')
      }
      const run: Run = {
        id: `run-${++next}`,
        projectId,
        kind: 'script',
        scriptId,
        title: scriptId,
        command: scriptId,
        status: 'running',
        pid: next,
        exitCode: null,
        stopped: false,
        startedAt: '2026-10-02T00:00:00.000Z'
      }
      runs.push(run)
      return { ...run }
    }),
    stop: vi.fn(async (runId: unknown) => {
      const run = runs.find((candidate) => candidate.id === runId)
      if (run && run.status !== 'exited')
        update(run, { status: 'exited', stopped: true, exitCode: 0 })
    }),
    list: () => runs.map((run) => ({ ...run })),
    output: (runId: unknown) => ({ data: outputs.get(String(runId)) ?? '', end: 0 }),
    print(runId: string, data: string) {
      outputs.set(runId, (outputs.get(runId) ?? '') + data)
      emit({ type: 'run-output', runId, offset: 0, data })
    },
    exit(runId: string, exitCode: number) {
      const run = runs.find((candidate) => candidate.id === runId)
      if (run) update(run, { status: 'exited', exitCode })
    }
  }
}
let manager: ReturnType<typeof fakeRuns>

const step = (id: string, scriptId: string, continueWhen: ContinueCondition) => ({
  id,
  projectId: 'p1',
  scriptId,
  continueWhen
})

describe('createGroupRunner', () => {
  let listeners: ((event: DevhubEvent) => void)[]
  let updates: GroupRunState[]
  let portOpen: boolean
  let groups: Map<string, Group>

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = []
    updates = []
    portOpen = false
    groups = new Map()
    const emit = (event: DevhubEvent): void => {
      if (event.type === 'group-updated') updates.push(event.state)
      listeners.forEach((listener) => listener(event))
    }
    manager = fakeRuns(emit)
    runner = createGroupRunner({
      groups: {
        async get(id) {
          const group = typeof id === 'string' ? groups.get(id) : undefined
          if (!group) throw new DevhubError('GROUP_NOT_FOUND', '批量任务不存在或已被删除')
          return group
        }
      },
      runs: manager,
      subscribe: (listener) => {
        listeners.push(listener)
        return () => (listeners = listeners.filter((l) => l !== listener))
      },
      checkPort: async () => portOpen,
      checkHttp: async () => false,
      emit
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  let runner: ReturnType<typeof createGroupRunner>
  const latest = () => updates.at(-1)
  const stepStates = () => latest()?.steps.map((s) => s.state)
  const define = (group: Group) => groups.set(group.id, group)
  const flush = () => vi.advanceTimersByTimeAsync(0)

  it('starts every step at once in parallel mode, reusing a script that already runs', async () => {
    await manager.start('p1', 'npm:api')
    define({
      id: 'g',
      name: 'front1',
      mode: 'parallel',
      steps: [
        step('s1', 'npm:web', { type: 'delay', seconds: 60 }),
        step('s2', 'npm:api', { type: 'delay', seconds: 60 })
      ]
    })
    await runner.start('g')
    await flush()
    expect(latest()).toMatchObject({ status: 'done' })
    expect(latest()?.steps.map((s) => s.message)).toEqual(['已启动', '已在运行'])
    expect(latest()?.steps.map((s) => s.reused)).toEqual([false, true])
    expect(manager.start).toHaveBeenCalledTimes(2) // the setup start + npm:web only
  })

  it('reports a step that cannot start in parallel mode, and still starts the rest', async () => {
    manager.failToStart.add('npm:gone')
    define({
      id: 'g',
      name: 'g',
      mode: 'parallel',
      steps: [
        step('s1', 'npm:gone', { type: 'delay', seconds: 0 }),
        step('s2', 'npm:web', { type: 'delay', seconds: 0 })
      ]
    })
    await runner.start('g')
    await flush()
    expect(latest()).toMatchObject({ status: 'failed' })
    expect(latest()?.steps).toMatchObject([
      { state: 'failed', message: '脚本不存在，可能已从项目中删除' },
      { state: 'done' }
    ])
  })

  it('runs serial steps one after another, each waiting for its condition', async () => {
    define({
      id: 'g',
      name: 'g',
      mode: 'serial',
      steps: [
        step('s1', 'npm:install', { type: 'exit', timeoutSeconds: 60 }),
        step('s2', 'npm:api', { type: 'port', port: 8080, timeoutSeconds: 60 }),
        step('s3', 'npm:web', { type: 'output', text: 'ready', timeoutSeconds: 60 })
      ]
    })
    const initial = await runner.start('g')
    expect(initial).toMatchObject({ status: 'running' })
    await flush()
    expect(stepStates()).toEqual(['running', 'pending', 'pending'])
    expect(latest()?.steps[0]?.message).toBe('等待进程成功退出')

    manager.exit('run-1', 0)
    await flush()
    expect(stepStates()).toEqual(['done', 'running', 'pending'])

    portOpen = true
    await vi.advanceTimersByTimeAsync(500)
    expect(stepStates()).toEqual(['done', 'done', 'running'])

    manager.print('run-3', 'VITE ready in 300ms')
    await flush()
    expect(latest()).toMatchObject({ status: 'done' })
    expect(manager.runs.map((run) => (run.kind === 'script' ? run.scriptId : null))).toEqual([
      'npm:install',
      'npm:api',
      'npm:web'
    ])
  })

  it('stops the sequence at a failed step and does not start the rest', async () => {
    define({
      id: 'g',
      name: 'g',
      mode: 'serial',
      steps: [
        step('s1', 'npm:build', { type: 'exit', timeoutSeconds: 60 }),
        step('s2', 'npm:web', { type: 'delay', seconds: 0 })
      ]
    })
    await runner.start('g')
    await flush()
    manager.exit('run-1', 1)
    await flush()
    expect(latest()).toMatchObject({ status: 'failed' })
    expect(latest()?.steps).toMatchObject([
      { state: 'failed', message: '进程退出码 1' },
      { state: 'cancelled' }
    ])
    expect(manager.start).toHaveBeenCalledTimes(1)
  })

  it('fails a step whose condition times out', async () => {
    define({
      id: 'g',
      name: 'g',
      mode: 'serial',
      steps: [step('s1', 'npm:web', { type: 'output', text: 'ready', timeoutSeconds: 5 })]
    })
    await runner.start('g')
    await vi.advanceTimersByTimeAsync(5000)
    expect(latest()?.steps[0]).toMatchObject({ state: 'failed', message: '等待超时（5 秒）' })
  })

  it('stop cancels the waiting sequence and stops every script of the group', async () => {
    define({
      id: 'g',
      name: 'g',
      mode: 'serial',
      steps: [
        step('s1', 'npm:api', { type: 'delay', seconds: 0 }),
        step('s2', 'npm:web', { type: 'output', text: 'ready', timeoutSeconds: 60 }),
        step('s3', 'npm:extra', { type: 'delay', seconds: 0 })
      ]
    })
    await runner.start('g')
    await flush()
    expect(stepStates()).toEqual(['done', 'running', 'pending'])

    await runner.stop('g')
    await flush()
    expect(latest()).toMatchObject({ status: 'stopped' })
    expect(stepStates()).toEqual(['done', 'cancelled', 'cancelled'])
    expect(manager.runs.every((run) => run.status === 'exited')).toBe(true)
    expect(manager.start).toHaveBeenCalledTimes(2)
  })

  it('refuses to start a group that is still running, and allows it again afterwards', async () => {
    define({
      id: 'g',
      name: 'front1',
      mode: 'serial',
      steps: [step('s1', 'npm:web', { type: 'output', text: 'ready', timeoutSeconds: 60 })]
    })
    await runner.start('g')
    await expect(runner.start('g')).rejects.toMatchObject({ code: 'GROUP_ALREADY_RUNNING' })
    await runner.stop('g')
    await expect(runner.start('g')).resolves.toMatchObject({ status: 'running' })
    await expect(runner.states()).resolves.toHaveLength(1)
  })

  it('rejects unknown groups', async () => {
    await expect(runner.start('nope')).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' })
    await expect(runner.stop('nope')).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' })
  })

  it('keeps reused information after a serial condition completes', async () => {
    await manager.start('p1', 'npm:web')
    define({
      id: 'g',
      name: 'g',
      mode: 'serial',
      steps: [step('s1', 'npm:web', { type: 'delay', seconds: 0 })]
    })
    await runner.start('g')
    await flush()
    expect(latest()?.steps[0]).toMatchObject({ state: 'done', runId: 'run-1', reused: true })
    expect(manager.start).toHaveBeenCalledTimes(1)
  })

  it('keeps execution configuration and stop scope when a group is edited', async () => {
    const original: Group = {
      id: 'g',
      name: 'original',
      mode: 'serial',
      steps: [step('s1', 'npm:web', { type: 'delay', seconds: 60 })]
    }
    define(original)
    await runner.start('g')
    await flush()
    await manager.start('p1', 'npm:other')
    original.steps[0] = step('new', 'npm:other', { type: 'delay', seconds: 0 })
    original.name = 'edited'
    await runner.stop('g')
    await flush()
    expect(latest()?.group).toMatchObject({ name: 'original', steps: [{ scriptId: 'npm:web' }] })
    expect(manager.stop).toHaveBeenCalledWith('run-1')
    expect(manager.stop).not.toHaveBeenCalledWith('run-2')
  })

  it.each(['parallel', 'serial'] as const)(
    'stops a delayed %s start without overwriting cancellation',
    async (mode) => {
      const start = manager.start.getMockImplementation()!
      let release: (() => void) | undefined
      manager.start.mockImplementation(async (projectId, scriptId) => {
        await new Promise<void>((resolve) => {
          release = resolve
        })
        return start(projectId, scriptId)
      })
      define({
        id: 'g',
        name: 'g',
        mode,
        steps: [step('s1', 'npm:web', { type: 'delay', seconds: 0 })]
      })
      await runner.start('g')
      await runner.stop('g')
      release?.()
      await flush()
      expect(latest()).toMatchObject({
        status: 'stopped',
        steps: [{ state: 'cancelled', runId: 'run-1', reused: false }]
      })
      expect(manager.runs[0]?.status).toBe('exited')
    }
  )
})
