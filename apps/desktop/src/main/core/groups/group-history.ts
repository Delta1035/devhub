import { z } from 'zod'
import { groupRunStateSchema, type GroupRunState } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

export const groupHistoryFileSchema = z.object({
  version: z.literal(1),
  states: z.array(groupRunStateSchema)
})
export type GroupHistoryFile = z.infer<typeof groupHistoryFileSchema>
export const emptyGroupHistoryFile = (): GroupHistoryFile => ({ version: 1, states: [] })

/** The last result of each group, kept across restarts. */
export interface GroupHistory {
  load(): Promise<GroupRunState[]>
  save(states: GroupRunState[]): Promise<void>
}

export function createGroupHistory(
  store: JsonStore<GroupHistoryFile>,
  now: () => Date = () => new Date()
): GroupHistory {
  return {
    async load() {
      return (await store.read()).states.map((state) => settleInterrupted(state, now()))
    },
    async save(states) {
      await store.write({ version: 1, states })
    }
  }
}

/**
 * A state saved as "running" means DevHub went away mid-execution (crash or forced quit):
 * nothing is waiting on it any more, so it is shown as stopped.
 */
export function settleInterrupted(state: GroupRunState, at: Date): GroupRunState {
  if (state.status !== 'running' && state.status !== 'ready') return state
  return {
    ...state,
    status: 'stopped',
    finishedAt:
      state.status === 'ready' ? at.toISOString() : (state.finishedAt ?? at.toISOString()),
    steps: state.steps.map((step) => {
      if (step.state === 'ready') return { ...step, state: 'stopped', message: undefined }
      if (step.state === 'pending' || step.state === 'running') {
        return { ...step, state: 'cancelled', message: undefined }
      }
      return step
    })
  }
}
