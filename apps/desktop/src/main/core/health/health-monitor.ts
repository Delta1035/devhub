import type { DevhubEvent, HealthState, Run, RunHealth } from '@devhub/shared'
import {
  checkHealthTarget,
  describeHealthTarget,
  type HealthCheckers,
  type HealthTarget
} from './health-target'

type ScriptRun = Extract<Run, { kind: 'script' }>

export interface HealthMonitorDeps {
  subscribe: (listener: (event: DevhubEvent) => void) => () => void
  /** What to check for a script run; null when there is nothing to check. */
  resolveTarget: (run: ScriptRun) => Promise<HealthTarget | null>
  checkers: HealthCheckers
  emit: (event: DevhubEvent) => void
  /** Poll interval until the first successful check. */
  startingIntervalMs?: number
  /** Poll interval once ready (or unhealthy). */
  readyIntervalMs?: number
  /** Failed checks in a row, after being ready, before a run counts as unhealthy. */
  failuresBeforeUnhealthy?: number
  now?: () => Date
}

export interface HealthMonitor {
  list(): RunHealth[]
  /** Stops every check; used when DevHub quits. */
  dispose(): void
}

interface Tracker {
  /** Null while the target is being resolved, or when the run has nothing to check. */
  health: RunHealth | null
  failures: number
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Checks running scripts for readiness (ADR 0011): starting → ready on the first success,
 * ready → unhealthy after several failures in a row, and back to ready when checks pass again.
 * Checks stop as soon as a run is stopping, exits or is removed.
 */
export function createHealthMonitor({
  subscribe,
  resolveTarget,
  checkers,
  emit,
  startingIntervalMs = 1000,
  readyIntervalMs = 5000,
  failuresBeforeUnhealthy = 3,
  now = () => new Date()
}: HealthMonitorDeps): HealthMonitor {
  const tracked = new Map<string, Tracker>()

  const untrack = (runId: string): void => {
    const tracker = tracked.get(runId)
    if (!tracker) return
    clearTimeout(tracker.timer)
    tracked.delete(runId)
    if (tracker.health) emit({ type: 'run-health', runId, health: null })
  }

  const setState = (tracker: Tracker, health: RunHealth, state: HealthState): void => {
    if (health.state === state) return
    tracker.health = { ...health, state, since: now().toISOString() }
    emit({ type: 'run-health', runId: health.runId, health: tracker.health })
  }

  const poll = async (runId: string, tracker: Tracker, target: HealthTarget): Promise<void> => {
    const ok = await checkHealthTarget(target, checkers)
    // The run may have stopped while the check was in flight.
    const health = tracker.health
    if (tracked.get(runId) !== tracker || !health) return
    if (ok) {
      tracker.failures = 0
      setState(tracker, health, 'ready')
    } else if (health.state !== 'starting') {
      tracker.failures++
      if (tracker.failures >= failuresBeforeUnhealthy) setState(tracker, health, 'unhealthy')
    }
    const interval = tracker.health?.state === 'starting' ? startingIntervalMs : readyIntervalMs
    tracker.timer = setTimeout(() => void poll(runId, tracker, target), interval)
  }

  const track = async (run: ScriptRun): Promise<void> => {
    const tracker: Tracker = { health: null, failures: 0 }
    // Registered before resolving, so repeated `run-updated` events do not track twice.
    tracked.set(run.id, tracker)
    const target = await resolveTarget(run).catch(() => null)
    if (tracked.get(run.id) !== tracker || !target) return
    tracker.health = {
      runId: run.id,
      state: 'starting',
      target: describeHealthTarget(target),
      since: now().toISOString()
    }
    emit({ type: 'run-health', runId: run.id, health: tracker.health })
    await poll(run.id, tracker, target)
  }

  const unsubscribe = subscribe((event) => {
    if (event.type === 'run-updated') {
      const { run } = event
      if (run.status !== 'running') untrack(run.id)
      else if (run.kind === 'script' && !tracked.has(run.id)) void track(run)
    } else if (event.type === 'run-removed') {
      untrack(event.runId)
    }
  })

  return {
    list: () =>
      [...tracked.values()].flatMap((tracker) => (tracker.health ? [tracker.health] : [])),

    dispose() {
      unsubscribe()
      for (const tracker of tracked.values()) clearTimeout(tracker.timer)
      tracked.clear()
    }
  }
}
