import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DevhubEvent, Run, RunHistoryOutput } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import {
  createRunHistory,
  emptyRunHistoryFile,
  runHistoryFileSchema,
  type RunHistoryFile,
  type RunHistoryDeps
} from './run-history'
import type { HistoryLogStore } from './history-log-store'

type ScriptRun = Extract<Run, { kind: 'script' }>

const exited = (id: string, overrides: Partial<ScriptRun> = {}): ScriptRun => ({
  id,
  projectId: 'p1',
  kind: 'script',
  scriptId: 'npm:dev',
  title: 'dev',
  command: 'pnpm run dev',
  status: 'exited',
  pid: 1,
  exitCode: 0,
  stopped: false,
  startedAt: '2026-10-03T10:00:00.000Z',
  endedAt: '2026-10-03T10:02:13.000Z',
  ...overrides
})

const memoryStore = (initial: RunHistoryFile = emptyRunHistoryFile()) => {
  let saved = structuredClone(initial)
  let writes = 0
  const store: JsonStore<RunHistoryFile> & { saved: () => RunHistoryFile; writes: () => number } = {
    read: async () => structuredClone(saved),
    write: async (value) => {
      writes++
      saved = structuredClone(value)
    },
    saved: () => saved,
    writes: () => writes
  }
  return store
}

const memoryLogs = (): HistoryLogStore & { saved: Map<string, RunHistoryOutput> } => {
  const saved = new Map<string, RunHistoryOutput>()
  return {
    saved,
    read: async (runId) => saved.get(runId) ?? null,
    write: async (runId, output) => {
      saved.set(runId, structuredClone(output))
    },
    remove: async (runId) => {
      saved.delete(runId)
    },
    prune: async (runIds) => {
      for (const runId of saved.keys()) if (!runIds.includes(runId)) saved.delete(runId)
    }
  }
}

const setup = (store = memoryStore(), limit?: number, extra: Partial<RunHistoryDeps> = {}) => {
  let listeners: ((event: DevhubEvent) => void)[] = []
  const history = createRunHistory({
    store,
    subscribe: (listener) => {
      listeners.push(listener)
      return () => (listeners = listeners.filter((l) => l !== listener))
    },
    ...(limit ? { limit } : {}),
    warn: () => undefined,
    ...extra
  })
  const publish = (event: DevhubEvent): void => listeners.forEach((listener) => listener(event))
  return { history, publish, store }
}

describe('createRunHistory', () => {
  afterEach(() => vi.useRealTimers())
  it('records how each script run ended, newest first, and saves it', async () => {
    const { history, publish, store } = setup()
    publish({ type: 'run-updated', run: exited('r1', { exitCode: 1 }) })
    publish({ type: 'run-updated', run: exited('r2', { stopped: true, exitCode: null }) })
    await history.flush()

    await expect(history.list('p1', 'npm:dev')).resolves.toEqual([
      {
        runId: 'r2',
        projectId: 'p1',
        scriptId: 'npm:dev',
        command: 'pnpm run dev',
        startedAt: '2026-10-03T10:00:00.000Z',
        endedAt: '2026-10-03T10:02:13.000Z',
        status: 'finished',
        exitCode: null,
        stopped: true
      },
      expect.objectContaining({ runId: 'r1', exitCode: 1, stopped: false })
    ])
    expect(store.saved().records.map((record) => record.runId)).toEqual(['r1', 'r2'])
  })

  it('persists starts, hides active runs from history, and ignores shells and duplicate exits', async () => {
    const { history, publish, store } = setup()
    publish({ type: 'run-updated', run: exited('running', { status: 'running', exitCode: null }) })
    publish({
      type: 'run-updated',
      run: { ...exited('s1'), kind: 'shell', shellId: 'bash' } as Run
    })
    publish({ type: 'run-updated', run: exited('r1') })
    publish({ type: 'run-updated', run: exited('r1') })
    await history.flush()
    expect(store.saved().records.map((record) => record.runId)).toEqual(['running', 'r1'])
    expect(store.saved().records[0]).toMatchObject({ status: 'running', endedAt: null })
    await expect(history.list('p1', 'npm:dev')).resolves.toHaveLength(1)
    expect(store.writes()).toBe(2)
  })

  it('keeps only the newest runs of each script', async () => {
    const { history, publish } = setup(memoryStore(), 3)
    for (const id of ['a', 'b', 'c', 'd', 'e']) publish({ type: 'run-updated', run: exited(id) })
    publish({ type: 'run-updated', run: exited('other', { scriptId: 'npm:build' }) })
    await history.flush()
    const ids = async (scriptId: string) =>
      (await history.list('p1', scriptId)).map((record) => record.runId)
    await expect(ids('npm:dev')).resolves.toEqual(['e', 'd', 'c'])
    await expect(ids('npm:build')).resolves.toEqual(['other'])
  })

  it('reads the runs of earlier sessions', async () => {
    const first = setup()
    first.publish({ type: 'run-updated', run: exited('r1') })
    await first.history.flush()

    const next = setup(first.store)
    await expect(next.history.list('p1', 'npm:dev')).resolves.toMatchObject([{ runId: 'r1' }])
    await expect(next.history.list('p1', 'npm:other')).resolves.toEqual([])
  })

  it('rejects invalid ids', async () => {
    const { history } = setup()
    await expect(history.list('', 'npm:dev')).rejects.toThrow('项目或脚本 id 无效')
    await expect(history.list('p1', 42)).rejects.toThrow('项目或脚本 id 无效')
  })

  it('keeps working in memory when the file cannot be written', async () => {
    const store = memoryStore()
    store.write = async () => {
      throw new Error('disk full')
    }
    const { history, publish } = setup(store)
    publish({ type: 'run-updated', run: exited('r1') })
    await history.flush()
    await expect(history.list('p1', 'npm:dev')).resolves.toMatchObject([{ runId: 'r1' }])
  })

  it('restores unfinished runs without inventing codes or end times, and retains their logs', async () => {
    const logs = memoryLogs()
    const first = setup(memoryStore(), undefined, { logs })
    first.publish({ type: 'run-updated', run: exited('live', { status: 'running' }) })
    first.publish({ type: 'run-output', runId: 'live', offset: 0, data: '日志已保存' })
    await first.history.flush()
    const next = setup(first.store, undefined, { logs })
    await expect(next.history.list('p1', 'npm:dev')).resolves.toMatchObject([
      { runId: 'live', status: 'interrupted', endedAt: null, exitCode: null, stopped: false }
    ])
    await expect(next.history.output('p1', 'npm:dev', 'live')).resolves.toEqual({
      data: '日志已保存',
      truncated: false
    })
    expect(first.store.saved().records[0]?.status).toBe('interrupted')
  })

  it('checkpoints running output and saves the final chunk before notifying', async () => {
    vi.useFakeTimers()
    const logs = memoryLogs()
    const emitted: DevhubEvent[] = []
    const { history, publish, store } = setup(memoryStore(), undefined, {
      logs,
      emit: (event) => emitted.push(event)
    })
    publish({ type: 'run-updated', run: exited('r', { status: 'running' }) })
    await history.list('p1', 'npm:dev')
    expect(store.saved().records[0]?.status).toBe('running')
    publish({ type: 'run-output', runId: 'r', offset: 0, data: 'before ' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(logs.saved.get('r')?.data).toBe('before ')
    publish({ type: 'run-output', runId: 'r', offset: 7, data: 'exit' })
    publish({ type: 'run-updated', run: exited('r') })
    await history.flush()
    await expect(history.output('p1', 'npm:dev', 'r')).resolves.toEqual({
      data: 'before exit',
      truncated: false
    })
    expect(emitted.at(-1)).toEqual({
      type: 'history-updated',
      projectId: 'p1',
      scriptId: 'npm:dev'
    })
  })

  it('keeps startup acknowledgement and exit history usable after a log write failure, then retries', async () => {
    vi.useFakeTimers()
    const logs = memoryLogs()
    const original = logs.write
    logs.write = vi.fn().mockRejectedValueOnce(new Error('disk busy')).mockImplementation(original)
    const { history, publish } = setup(memoryStore(), undefined, { logs })
    publish({ type: 'run-updated', run: exited('retry', { status: 'running' }) })
    await expect(history.flush()).resolves.toBeUndefined()
    publish({ type: 'run-output', runId: 'retry', offset: 0, data: 'retained' })
    logs.write = vi.fn().mockRejectedValueOnce(new Error('disk busy')).mockImplementation(original)
    publish({ type: 'run-updated', run: exited('retry') })
    await expect(history.list('p1', 'npm:dev')).resolves.toMatchObject([{ status: 'finished' }])
    await vi.advanceTimersByTimeAsync(1000)
    await expect(history.output('p1', 'npm:dev', 'retry')).resolves.toEqual({
      data: 'retained',
      truncated: false
    })
    await history.flush()
  })

  it('retains history when a clear cannot write metadata, allowing a successful retry', async () => {
    const { history, publish, store } = setup()
    publish({ type: 'run-updated', run: exited('kept') })
    await history.flush()
    const original = store.write
    store.write = async () => {
      throw new Error('disk full')
    }
    await expect(history.clear('p1', 'npm:dev')).rejects.toThrow('disk full')
    await expect(history.list('p1', 'npm:dev')).resolves.toMatchObject([{ runId: 'kept' }])
    store.write = original
    await history.clear('p1', 'npm:dev')
    await expect(history.list('p1', 'npm:dev')).resolves.toEqual([])
  })

  it('clears ended history of one script while retaining the live execution and other scopes', async () => {
    const logs = memoryLogs()
    const { history, publish } = setup(memoryStore(), undefined, { logs })
    for (const run of [
      exited('old'),
      exited('other', { scriptId: 'npm:test' }),
      exited('project2', { projectId: 'p2' }),
      exited('live', { status: 'running' })
    ]) {
      publish({ type: 'run-updated', run })
      publish({ type: 'run-output', runId: run.id, offset: 0, data: run.id })
    }
    await history.flush()
    await history.clear('p1', 'npm:dev')
    await expect(history.list('p1', 'npm:dev')).resolves.toEqual([])
    expect(logs.saved.has('old')).toBe(false)
    expect(logs.saved.has('other')).toBe(true)
    expect(logs.saved.has('project2')).toBe(true)
    expect(logs.saved.has('live')).toBe(true)
    publish({ type: 'run-updated', run: exited('live') })
    await history.flush()
    await expect(history.list('p1', 'npm:dev')).resolves.toMatchObject([{ runId: 'live' }])
    await expect(history.output('p1', 'npm:dev', 'old')).rejects.toMatchObject({
      code: 'RUN_NOT_FOUND'
    })
  })

  it('deletes a removed project and ignores late start, output and exit events', async () => {
    const logs = memoryLogs()
    const { history, publish, store } = setup(memoryStore(), undefined, { logs })
    publish({ type: 'run-updated', run: exited('old') })
    publish({ type: 'run-updated', run: exited('live', { status: 'running' }) })
    await history.flush()
    await history.forgetProject('p1')
    publish({ type: 'run-output', runId: 'live', offset: 0, data: 'late' })
    publish({ type: 'run-updated', run: exited('live') })
    publish({ type: 'run-updated', run: exited('new') })
    await history.flush()
    expect(store.saved().records).toEqual([])
    expect(logs.saved.size).toBe(0)
  })

  it('evicts logs with old records and applies the limit after interrupted recovery', async () => {
    const logs = memoryLogs()
    const { history, publish, store } = setup(memoryStore(), 1, { logs })
    publish({ type: 'run-updated', run: exited('a') })
    publish({ type: 'run-updated', run: exited('b') })
    await history.flush()
    expect(logs.saved.has('a')).toBe(false)
    expect(logs.saved.has('b')).toBe(true)
    publish({ type: 'run-updated', run: exited('c', { status: 'running' }) })
    await history.flush()
    const recovered = setup(store, 1, { logs })
    await expect(recovered.history.list('p1', 'npm:dev')).resolves.toMatchObject([
      { runId: 'c', status: 'interrupted' }
    ])
    expect(logs.saved.has('b')).toBe(false)
  })

  it('cleans removed projects and unreferenced logs at startup', async () => {
    const logs = memoryLogs()
    const first = setup(memoryStore(), undefined, { logs })
    first.publish({ type: 'run-updated', run: exited('removed') })
    first.publish({ type: 'run-updated', run: exited('kept', { projectId: 'p2' }) })
    await first.history.flush()
    const next = setup(first.store, undefined, { logs, projectIds: async () => ['p2'] })
    await next.history.flush()
    expect(first.store.saved().records.map((record) => record.runId)).toEqual(['kept'])
    expect(logs.saved.has('removed')).toBe(false)
    expect(logs.saved.has('kept')).toBe(true)
  })

  it('reads old history without logs and rejects invalid or mismatched requests', async () => {
    const legacy = runHistoryFileSchema.parse({
      version: 1,
      records: [
        {
          runId: 'old',
          projectId: 'p1',
          scriptId: 'npm:dev',
          command: 'old command',
          startedAt: '2026-10-03T10:00:00.000Z',
          endedAt: '2026-10-03T10:01:00.000Z',
          exitCode: 0,
          stopped: false
        }
      ]
    })
    const { history } = setup(memoryStore(legacy))
    await expect(history.list('p1', 'npm:dev')).resolves.toMatchObject([
      { status: 'finished', runId: 'old' }
    ])
    await expect(history.output('p1', 'npm:dev', 'old')).resolves.toBeNull()
    await expect(history.output('p2', 'npm:dev', 'old')).rejects.toMatchObject({
      code: 'RUN_NOT_FOUND'
    })
    await expect(history.output('p1', 'npm:dev', 4)).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    })
    expect(() => history.clear('', 'npm:dev')).toThrow('项目或脚本 id 无效')
    expect(() => history.forgetProject(3)).toThrow('项目 id 无效')
  })
})
