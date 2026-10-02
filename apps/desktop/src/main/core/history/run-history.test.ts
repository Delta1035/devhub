import { describe, expect, it } from 'vitest'
import type { DevhubEvent, Run } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import { createRunHistory, emptyRunHistoryFile, type RunHistoryFile } from './run-history'

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

const setup = (store = memoryStore(), limit?: number) => {
  let listeners: ((event: DevhubEvent) => void)[] = []
  const history = createRunHistory({
    store,
    subscribe: (listener) => {
      listeners.push(listener)
      return () => (listeners = listeners.filter((l) => l !== listener))
    },
    ...(limit ? { limit } : {}),
    warn: () => undefined
  })
  const publish = (event: DevhubEvent): void => listeners.forEach((listener) => listener(event))
  return { history, publish, store }
}

describe('createRunHistory', () => {
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
        exitCode: null,
        stopped: true
      },
      expect.objectContaining({ runId: 'r1', exitCode: 1, stopped: false })
    ])
    expect(store.saved().records.map((record) => record.runId)).toEqual(['r1', 'r2'])
  })

  it('ignores running runs, shells, and a repeated exit of the same run', async () => {
    const { history, publish, store } = setup()
    publish({ type: 'run-updated', run: exited('running', { status: 'running', exitCode: null }) })
    publish({
      type: 'run-updated',
      run: { ...exited('s1'), kind: 'shell', shellId: 'bash' } as Run
    })
    publish({ type: 'run-updated', run: exited('r1') })
    publish({ type: 'run-updated', run: exited('r1') })
    await history.flush()
    expect(store.saved().records.map((record) => record.runId)).toEqual(['r1'])
    expect(store.writes()).toBe(1)
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
})
