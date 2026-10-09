import type { Run } from './domain'
import type { GroupRunState } from './groups'

/**
 * A batch run that still has something going on. An execution ends as soon as its scripts
 * are started (parallel) or the last step's condition is met (serial), while the servers it
 * started keep running; both count as active.
 */
export interface ActiveGroup {
  groupId: string
  /** `starting`: the execution is in progress; `running`: it ended, its scripts still run. */
  phase: 'starting' | 'running'
  /** Starting: steps done so far; running: scripts still alive. */
  current: number
  total: number
  /** Runs of the latest execution that have not exited, started or reused by it. */
  runIds: string[]
}

/** Active groups in the order of `states`; groups whose scripts all exited are left out. */
export function activeGroups(states: GroupRunState[], runs: Run[]): ActiveGroup[] {
  const alive = new Set(runs.filter((run) => run.status !== 'exited').map((run) => run.id))
  const result: ActiveGroup[] = []
  for (const state of states) {
    const runIds = [
      ...new Set(state.steps.flatMap((step) => (step.runId ? [step.runId] : [])))
    ].filter((runId) => alive.has(runId))
    const total = state.steps.length
    if (state.status === 'running') {
      const done = state.steps.filter((step) => step.state === 'done').length
      result.push({ groupId: state.groupId, phase: 'starting', current: done, total, runIds })
    } else if (runIds.length > 0) {
      result.push({
        groupId: state.groupId,
        phase: 'running',
        current: runIds.length,
        total,
        runIds
      })
    }
  }
  return result
}
