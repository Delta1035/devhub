import { describe, expect, it, vi } from 'vitest'
import type { Run } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import { createRunRegistry, emptyRunsFile, type RunsFile } from './run-registry'

const memoryStore = (initial: RunsFile = emptyRunsFile()) => {
  let saved = structuredClone(initial)
  const store: JsonStore<RunsFile> & { saved: () => RunsFile } = {
    read: async () => structuredClone(saved),
    write: async (value) => {
      saved = structuredClone(value)
    },
    saved: () => saved
  }
  return store
}

const run = (id: string, pid: number, status: Run['status'] = 'running'): Run => ({
  id,
  projectId: 'p1',
  kind: 'script',
  scriptId: 'npm:dev',
  title: 'dev',
  command: 'pnpm run dev',
  status,
  pid,
  exitCode: status === 'exited' ? 0 : null,
  stopped: false,
  startedAt: '2026-10-02T00:00:00.000Z'
})

const oldRecord = (runId: string, pid: number, identity: string) => ({
  runId,
  pid,
  projectId: 'p1',
  title: 'api',
  command: 'mvnw.cmd spring-boot:run',
  startedAt: '2026-10-01T09:00:00.000Z',
  identity
})

/** Lets the registry's queued file updates finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createRunRegistry', () => {
  const setup = (initial?: RunsFile, alive: Record<number, string> = {}) => {
    const store = memoryStore(initial)
    const live = new Map(Object.entries(alive).map(([pid, id]) => [Number(pid), id]))
    const killer = { forceKill: vi.fn(async (pid: number) => void live.delete(pid)) }
    const registry = createRunRegistry({
      store,
      readIdentities: async (pids) =>
        new Map(pids.flatMap((pid) => (live.has(pid) ? [[pid, live.get(pid)!] as const] : []))),
      killer
    })
    return { store, registry, killer, live }
  }

  it('records a started run with its process identity and forgets it on exit', async () => {
    const { store, registry } = setup(undefined, { 100: 't-100' })
    registry.handle({ type: 'run-updated', run: run('r1', 100) })
    await settle()
    expect(store.saved().runs).toEqual([
      expect.objectContaining({ runId: 'r1', pid: 100, identity: 't-100', title: 'dev' })
    ])

    registry.handle({ type: 'run-updated', run: run('r1', 100, 'exited') })
    await settle()
    expect(store.saved().runs).toEqual([])
  })

  it('does not record a run whose process is already gone', async () => {
    const { store, registry } = setup()
    registry.handle({ type: 'run-updated', run: run('r1', 100) })
    await settle()
    expect(store.saved().runs).toEqual([])
  })

  it("reports a previous session's process only if pid and start time still match", async () => {
    const { store, registry } = setup(
      {
        version: 1,
        runs: [
          oldRecord('old-alive', 200, 't-200'),
          oldRecord('old-reused', 300, 't-300-old'),
          oldRecord('old-gone', 400, 't-400')
        ]
      },
      { 200: 't-200', 300: 't-300-new' }
    )
    await expect(registry.orphans()).resolves.toEqual([
      {
        pid: 200,
        projectId: 'p1',
        title: 'api',
        command: 'mvnw.cmd spring-boot:run',
        startedAt: '2026-10-01T09:00:00.000Z'
      }
    ])
    await settle()
    // Dead and reused entries need no decision and are dropped from the file.
    expect(store.saved().runs.map((entry) => entry.runId)).toEqual(['old-alive'])
  })

  it('never reports runs of the current session', async () => {
    const { registry } = setup(undefined, { 100: 't-100' })
    registry.handle({ type: 'run-updated', run: run('r1', 100) })
    await settle()
    await expect(registry.orphans()).resolves.toEqual([])
  })

  it('kills orphans (re-checking identities) and forgets them', async () => {
    const { store, registry, killer } = setup(
      { version: 1, runs: [oldRecord('old', 200, 't-200')] },
      { 200: 't-200' }
    )
    await registry.killOrphans()
    expect(killer.forceKill).toHaveBeenCalledWith(200)
    expect(store.saved().runs).toEqual([])
    await expect(registry.orphans()).resolves.toEqual([])
  })

  it('dismisses orphans without killing them', async () => {
    const { store, registry, killer } = setup(
      { version: 1, runs: [oldRecord('old', 200, 't-200')] },
      { 200: 't-200' }
    )
    await registry.dismissOrphans()
    expect(killer.forceKill).not.toHaveBeenCalled()
    expect(store.saved().runs).toEqual([])
    await expect(registry.orphans()).resolves.toEqual([])
  })

  it('keeps recording new runs next to undecided orphans', async () => {
    const { store, registry } = setup(
      { version: 1, runs: [oldRecord('old', 200, 't-200')] },
      { 200: 't-200', 100: 't-100' }
    )
    registry.handle({ type: 'run-updated', run: run('r1', 100) })
    await settle()
    expect(store.saved().runs.map((entry) => entry.runId)).toEqual(['old', 'r1'])
    await registry.dismissOrphans()
    expect(store.saved().runs.map((entry) => entry.runId)).toEqual(['r1'])
  })
})

describe('createRunRegistry writes', () => {
  it('writes nothing when there is nothing to record or forget', async () => {
    const store = memoryStore()
    const write = vi.spyOn(store, 'write')
    const registry = createRunRegistry({
      store,
      readIdentities: async () => new Map(),
      killer: { forceKill: vi.fn() }
    })
    await registry.orphans()
    await settle()
    expect(write).not.toHaveBeenCalled()
  })
})
