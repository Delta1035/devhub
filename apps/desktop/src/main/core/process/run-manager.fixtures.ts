import { vi, type Mock } from 'vitest'
import { DevhubError, type DevhubEvent, type Project, type Script } from '@devhub/shared'
import type { ProcessKiller } from './process-killer'
import type { PtyProcess, PtySpawnOptions } from './pty'
import { createRunManager, type RunManager, type RunManagerDeps } from './run-manager'

/** Test doubles shared by the run manager unit tests. */
export class FakePty implements PtyProcess {
  written: string[] = []
  sizes: [number, number][] = []
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
  resize(cols: number, rows: number): void {
    this.sizes.push([cols, rows])
  }
  emitData(data: string): void {
    for (const listener of this.dataListeners) listener(data)
  }
  emitExit(exitCode: number): void {
    for (const listener of this.exitListeners) listener(exitCode)
  }
}

export const project: Project = {
  id: 'p1',
  name: 'web',
  path: '/repo',
  addedAt: '2026-10-02T00:00:00.000Z'
}

const scriptsById: Record<string, Script> = {
  'npm:dev': { id: 'npm:dev', name: 'dev', source: 'npm', command: 'pnpm run dev' },
  'npm:api': { id: 'npm:api', name: 'api', source: 'npm', command: 'pnpm run api', cwd: 'server' }
}

export interface TestHarness {
  ptys: FakePty[]
  spawned: PtySpawnOptions[]
  events: DevhubEvent[]
  killer: {
    interrupt: Mock<ProcessKiller['interrupt']>
    forceKill: Mock<ProcessKiller['forceKill']>
  }
  makeManager(overrides?: Partial<RunManagerDeps>): RunManager
}

/** Call in beforeEach (with fake timers) to get a fresh manager factory and recorders. */
export function createHarness(): TestHarness {
  let nextPid = 100
  let nextId = 0
  const harness: TestHarness = {
    ptys: [],
    spawned: [],
    events: [],
    killer: {
      interrupt: vi.fn<ProcessKiller['interrupt']>(),
      forceKill: vi.fn<ProcessKiller['forceKill']>(async () => undefined)
    },
    makeManager: (overrides = {}) =>
      createRunManager({
        scripts: {
          async find(projectId, scriptId) {
            const script = typeof scriptId === 'string' ? scriptsById[scriptId] : undefined
            if (projectId !== 'p1' || !script) throw new DevhubError('SCRIPT_NOT_FOUND', 'nope')
            return { project, script }
          }
        },
        spawn: (options) => {
          harness.spawned.push(options)
          const pty = new FakePty(nextPid++)
          harness.ptys.push(pty)
          return pty
        },
        killer: harness.killer,
        platform: 'linux',
        emit: (event) => harness.events.push(event),
        env: { PATH: '/bin', EMPTY: undefined },
        graceMs: 1000,
        forceTimeoutMs: 500,
        outputLimit: 10,
        outputFlushMs: 16,
        now: () => new Date('2026-10-02T12:00:00.000Z'),
        newId: () => `run-${++nextId}`,
        ...overrides
      })
  }
  return harness
}
