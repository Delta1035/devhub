import { z } from 'zod'
import { orphanedRunSchema, type DevhubEvent, type OrphanedRun, type Run } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import type { ReadIdentities } from './process-identity'
import type { ProcessKiller } from './process-killer'

const recordSchema = orphanedRunSchema.extend({
  runId: z.string(),
  /** Process start time when it was recorded; see process-identity. */
  identity: z.string()
})
type RunRecord = z.infer<typeof recordSchema>

export const runsFileSchema = z.object({ version: z.literal(1), runs: z.array(recordSchema) })
export type RunsFile = z.infer<typeof runsFileSchema>
export const emptyRunsFile = (): RunsFile => ({ version: 1, runs: [] })

/**
 * Remembers which processes DevHub started, so that after a crash or forced quit the next
 * session can find the ones still running and offer to stop them. Runs are recorded when
 * they start and forgotten when they exit, driven by the core's run events.
 */
export interface RunRegistry {
  /** Feed every core event here. */
  handle(event: DevhubEvent): void
  /** Processes from previous sessions that are still alive (same pid and start time). */
  orphans(): Promise<OrphanedRun[]>
  killOrphans(): Promise<void>
  dismissOrphans(): Promise<void>
}

export interface RunRegistryDeps {
  store: JsonStore<RunsFile>
  readIdentities: ReadIdentities
  killer: Pick<ProcessKiller, 'forceKill'>
}

export function createRunRegistry({ store, readIdentities, killer }: RunRegistryDeps): RunRegistry {
  // Serialized read-modify-write, as in the other stores. `fn` returns false when it changed
  // nothing, so nothing is written (no file appears until a run is actually recorded).
  let queue: Promise<unknown> = Promise.resolve()
  const mutate = (fn: (data: RunsFile) => Promise<boolean> | boolean): Promise<void> => {
    const next = queue.then(async () => {
      const data = await store.read()
      if (await fn(data)) await store.write(data)
    })
    queue = next.catch(() => undefined)
    return next
  }

  // Records left by earlier sessions: everything in the file before this session wrote.
  let previous: Promise<RunRecord[]> = queue.then(async () => [...(await store.read()).runs])
  queue = previous.catch(() => undefined)
  const ownRunIds = new Set<string>()

  const record = (run: Run): void => {
    ownRunIds.add(run.id)
    void mutate(async (data) => {
      const identity = (await readIdentities([run.pid])).get(run.pid)
      // Already gone (very short run): nothing could be left behind.
      if (identity === undefined || !ownRunIds.has(run.id)) return false
      data.runs.push({
        runId: run.id,
        pid: run.pid,
        projectId: run.projectId,
        title: run.title,
        command: run.command,
        startedAt: run.startedAt,
        identity
      })
      return true
    }).catch((error: unknown) => console.warn('[runs] could not record run', error))
  }

  const forget = (runIds: Set<string>): Promise<void> =>
    mutate((data) => {
      const kept = data.runs.filter((entry) => !runIds.has(entry.runId))
      const changed = kept.length !== data.runs.length
      data.runs = kept
      return changed
    })

  /** Previous records whose process is still the same process. */
  const aliveOrphans = async (): Promise<RunRecord[]> => {
    const records = await previous
    const identities = await readIdentities(records.map((entry) => entry.pid))
    return records.filter((entry) => identities.get(entry.pid) === entry.identity)
  }

  // Previous records that are no longer alive need no decision: drop them right away.
  void (async () => {
    const records = await previous
    const alive = new Set((await aliveOrphans()).map((entry) => entry.runId))
    await forget(new Set(records.filter((entry) => !alive.has(entry.runId)).map((e) => e.runId)))
  })().catch((error: unknown) => console.warn('[runs] could not check old runs', error))

  /** Handled (stopped or dismissed): earlier sessions leave nothing more to report. */
  const forgetPrevious = async (): Promise<void> => {
    const records = await previous
    previous = Promise.resolve([])
    await forget(new Set(records.map((entry) => entry.runId)))
  }

  return {
    handle(event) {
      if (event.type !== 'run-updated') return
      const { run } = event
      if (run.status === 'running' && !ownRunIds.has(run.id)) record(run)
      else if (run.status === 'exited' && ownRunIds.has(run.id)) {
        ownRunIds.delete(run.id)
        void forget(new Set([run.id])).catch(() => undefined)
      }
    },

    async orphans() {
      return (await aliveOrphans()).map(({ pid, projectId, title, command, startedAt }) => ({
        pid,
        projectId,
        title,
        command,
        startedAt
      }))
    },

    async killOrphans() {
      // Re-check identities right before killing: a pid could have been reused meanwhile.
      await Promise.all((await aliveOrphans()).map((entry) => killer.forceKill(entry.pid)))
      await forgetPrevious()
    },

    dismissOrphans: forgetPrevious
  }
}
