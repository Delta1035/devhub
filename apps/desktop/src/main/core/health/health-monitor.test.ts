import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DevhubEvent, HealthState, Run } from '@devhub/shared'
import { createHealthMonitor, type HealthMonitor } from './health-monitor'
import type { HealthTarget } from './health-target'

type ScriptRun = Extract<Run, { kind: 'script' }>

const scriptRun = (overrides: Partial<ScriptRun> = {}): ScriptRun => ({
  id: 'r1',
  projectId: 'p1',
  kind: 'script',
  scriptId: 'npm:dev',
  title: 'dev',
  command: 'vite',
  status: 'running',
  pid: 1,
  exitCode: null,
  stopped: false,
  startedAt: '2026-10-02T00:00:00.000Z',
  ...overrides
})

describe('createHealthMonitor', () => {
  let listeners: ((event: DevhubEvent) => void)[]
  let emitted: DevhubEvent[]
  let portOpen: boolean
  let target: HealthTarget | null
  let monitor: HealthMonitor

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = []
    emitted = []
    portOpen = false
    target = { type: 'ports', ports: [5173] }
    monitor = createHealthMonitor({
      subscribe: (listener) => {
        listeners.push(listener)
        return () => (listeners = listeners.filter((l) => l !== listener))
      },
      resolveTarget: async () => target,
      checkers: { checkPort: async () => portOpen, checkHttp: async () => false },
      emit: (event) => emitted.push(event),
      startingIntervalMs: 1000,
      readyIntervalMs: 5000,
      failuresBeforeUnhealthy: 3
    })
  })

  afterEach(() => {
    monitor.dispose()
    vi.useRealTimers()
  })

  const publish = (event: DevhubEvent): void => listeners.forEach((listener) => listener(event))
  /** The states announced so far, in order; null when the run stopped being checked. */
  const states = (): (HealthState | null)[] =>
    emitted.flatMap((event) => (event.type === 'run-health' ? [event.health?.state ?? null] : []))

  it('is starting until the port opens, then ready', async () => {
    publish({ type: 'run-updated', run: scriptRun() })
    await vi.advanceTimersByTimeAsync(0)
    expect(states()).toEqual(['starting'])
    expect(monitor.list()).toMatchObject([{ runId: 'r1', state: 'starting', target: '端口 5173' }])

    await vi.advanceTimersByTimeAsync(3000)
    expect(states()).toEqual(['starting'])
    portOpen = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(states()).toEqual(['starting', 'ready'])
  })

  it('turns unhealthy only after several failures in a row, and recovers', async () => {
    portOpen = true
    publish({ type: 'run-updated', run: scriptRun() })
    await vi.advanceTimersByTimeAsync(0)
    expect(states()).toEqual(['starting', 'ready'])

    portOpen = false
    await vi.advanceTimersByTimeAsync(5000 * 2)
    expect(states()).toEqual(['starting', 'ready'])
    // A single success resets the count.
    portOpen = true
    await vi.advanceTimersByTimeAsync(5000)
    portOpen = false
    await vi.advanceTimersByTimeAsync(5000 * 2)
    expect(states()).toEqual(['starting', 'ready'])
    await vi.advanceTimersByTimeAsync(5000)
    expect(states()).toEqual(['starting', 'ready', 'unhealthy'])

    portOpen = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(states()).toEqual(['starting', 'ready', 'unhealthy', 'ready'])
  })

  it('stops checking when the run stops, and when it is removed', async () => {
    publish({ type: 'run-updated', run: scriptRun() })
    publish({ type: 'run-updated', run: scriptRun({ id: 'r2' }) })
    await vi.advanceTimersByTimeAsync(0)
    publish({ type: 'run-updated', run: scriptRun({ status: 'stopping' }) })
    publish({ type: 'run-removed', runId: 'r2' })
    expect(emitted.slice(-2)).toEqual([
      { type: 'run-health', runId: 'r1', health: null },
      { type: 'run-health', runId: 'r2', health: null }
    ])
    expect(monitor.list()).toEqual([])

    const before = emitted.length
    portOpen = true
    await vi.advanceTimersByTimeAsync(10_000)
    expect(emitted).toHaveLength(before)
  })

  it('ignores shells, runs without a target, and repeated updates of a checked run', async () => {
    publish({
      type: 'run-updated',
      run: { ...scriptRun({ id: 's1' }), kind: 'shell', shellId: 'bash' } as Run
    })
    target = null
    publish({ type: 'run-updated', run: scriptRun({ id: 'none' }) })
    await vi.advanceTimersByTimeAsync(0)
    expect(emitted).toEqual([])

    target = { type: 'ports', ports: [5173] }
    publish({ type: 'run-updated', run: scriptRun() })
    publish({ type: 'run-updated', run: scriptRun() })
    await vi.advanceTimersByTimeAsync(0)
    expect(states()).toEqual(['starting'])
    // Removing a run that never had a target announces nothing.
    publish({ type: 'run-removed', runId: 'none' })
    expect(states()).toEqual(['starting'])
  })

  it('drops a result that arrives after the run stopped', async () => {
    let answer: (open: boolean) => void = () => undefined
    monitor.dispose()
    monitor = createHealthMonitor({
      subscribe: (listener) => {
        listeners.push(listener)
        return () => (listeners = listeners.filter((l) => l !== listener))
      },
      resolveTarget: async () => target,
      checkers: {
        checkPort: () => new Promise((resolve) => (answer = resolve)),
        checkHttp: async () => false
      },
      emit: (event) => emitted.push(event)
    })
    publish({ type: 'run-updated', run: scriptRun() })
    await vi.advanceTimersByTimeAsync(0)
    publish({ type: 'run-updated', run: scriptRun({ status: 'exited', exitCode: 0 }) })
    answer(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(states()).toEqual(['starting', null])
  })
})
