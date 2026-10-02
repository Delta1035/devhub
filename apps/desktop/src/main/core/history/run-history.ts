import { z } from 'zod'
import {
  DevhubError,
  runHistoryLimit,
  runRecordSchema,
  type DevhubEvent,
  type Run,
  type RunRecord
} from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

export const runHistoryFileSchema = z.object({
  version: z.literal(1),
  records: z.array(runRecordSchema)
})
export type RunHistoryFile = z.infer<typeof runHistoryFileSchema>
export const emptyRunHistoryFile = (): RunHistoryFile => ({ version: 1, records: [] })

export interface RunHistoryDeps {
  store: JsonStore<RunHistoryFile>
  subscribe: (listener: (event: DevhubEvent) => void) => () => void
  /** Finished runs kept per script. */
  limit?: number
  warn?: (message: string, error: unknown) => void
}

export interface RunHistory {
  /** Finished runs of one script, newest first. */
  list(projectId: unknown, scriptId: unknown): Promise<RunRecord[]>
  /** Resolves once every recorded run has been written; used when DevHub quits. */
  flush(): Promise<void>
}

const idInput = z.string().min(1)

/**
 * Records how each script run ended (scripts only; interactive shells are not history). Kept in
 * `run-history.json` across restarts. A run is recorded when it exits, so one still running when
 * DevHub crashes is not.
 */
export function createRunHistory({
  store,
  subscribe,
  limit = runHistoryLimit,
  warn = (message, error) => console.warn(message, error)
}: RunHistoryDeps): RunHistory {
  // Loaded once; afterwards the memory copy is the truth and every change rewrites the file.
  let records: Promise<RunRecord[]> | null = null
  const load = (): Promise<RunRecord[]> => {
    records ??= store.read().then(
      (file) => file.records,
      (error: unknown) => {
        warn('[history] could not read run history', error)
        return []
      }
    )
    return records
  }
  // Writes run one after another so an older snapshot never overwrites a newer one.
  let writing: Promise<void> = Promise.resolve()

  const record = async (run: Extract<Run, { kind: 'script' }>): Promise<void> => {
    const all = await load()
    if (all.some((entry) => entry.runId === run.id)) return
    all.push({
      runId: run.id,
      projectId: run.projectId,
      scriptId: run.scriptId,
      command: run.command,
      startedAt: run.startedAt,
      endedAt: run.endedAt ?? run.startedAt,
      exitCode: run.exitCode,
      stopped: run.stopped
    })
    // Keep only the newest `limit` runs of this script; records are in finishing order.
    const same = all.filter(
      (entry) => entry.projectId === run.projectId && entry.scriptId === run.scriptId
    )
    for (const old of same.slice(0, Math.max(0, same.length - limit))) {
      all.splice(all.indexOf(old), 1)
    }
    const snapshot: RunHistoryFile = { version: 1, records: [...all] }
    writing = writing
      .then(() => store.write(snapshot))
      .catch((error: unknown) => warn('[history] could not save run history', error))
    await writing
  }

  const pending = new Set<Promise<void>>()
  subscribe((event) => {
    if (
      event.type === 'run-updated' &&
      event.run.kind === 'script' &&
      event.run.status === 'exited'
    ) {
      const recording = record(event.run)
      pending.add(recording)
      void recording.finally(() => pending.delete(recording))
    }
  })

  return {
    async list(rawProjectId, rawScriptId) {
      const projectId = idInput.safeParse(rawProjectId)
      const scriptId = idInput.safeParse(rawScriptId)
      if (!projectId.success || !scriptId.success) {
        throw new DevhubError('INVALID_INPUT', '项目或脚本 id 无效')
      }
      const all = await load()
      return all
        .filter((entry) => entry.projectId === projectId.data && entry.scriptId === scriptId.data)
        .reverse()
    },

    async flush() {
      await Promise.all(pending)
    }
  }
}
