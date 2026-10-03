import { z } from 'zod'
import {
  DevhubError,
  runHistoryLimit,
  runRecordSchema,
  type DevhubEvent,
  type Run,
  type RunRecord,
  type RunHistoryOutput
} from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import type { HistoryLogStore } from './history-log-store'
import { HistoryOutput } from './history-output'

export const runHistoryFileSchema = z.object({
  version: z.literal(1),
  records: z.array(runRecordSchema)
})
export type RunHistoryFile = z.infer<typeof runHistoryFileSchema>
export const emptyRunHistoryFile = (): RunHistoryFile => ({ version: 1, records: [] })

export interface RunHistoryDeps {
  store: JsonStore<RunHistoryFile>
  logs?: HistoryLogStore
  subscribe: (listener: (event: DevhubEvent) => void) => () => void
  emit?: (event: DevhubEvent) => void
  /** Used at startup to clean up records belonging to removed projects. */
  projectIds?: () => Promise<string[]>
  limit?: number
  checkpointMs?: number
  warn?: (message: string, error: unknown) => void
}

export interface RunHistory {
  list(projectId: unknown, scriptId: unknown): Promise<RunRecord[]>
  output(projectId: unknown, scriptId: unknown, runId: unknown): Promise<RunHistoryOutput | null>
  clear(projectId: unknown, scriptId: unknown): Promise<void>
  forgetProject(projectId: unknown): Promise<void>
  flush(): Promise<void>
}

const id = z.string().min(1).max(1024)
const scopeSchema = z.object({ projectId: id, scriptId: id })
function scope(projectId: unknown, scriptId: unknown): { projectId: string; scriptId: string } {
  const result = scopeSchema.safeParse({ projectId, scriptId })
  if (!result.success) throw new DevhubError('INVALID_INPUT', '项目或脚本 id 无效')
  return result.data
}
const matches = (record: RunRecord, target: { projectId: string; scriptId: string }): boolean =>
  record.projectId === target.projectId && record.scriptId === target.scriptId

/** Metadata is saved at start/exit. Separate capped logs checkpoint during a run. */
export function createRunHistory({
  store,
  logs,
  subscribe,
  emit = () => undefined,
  projectIds,
  limit = runHistoryLimit,
  checkpointMs = 1000,
  warn = (message, error) => console.warn(message, error)
}: RunHistoryDeps): RunHistory {
  let records: RunRecord[] = []
  const buffers = new Map<string, HistoryOutput>()
  const dirty = new Set<string>()
  const removedProjects = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = (record: { projectId: string; scriptId: string }): void =>
    emit({ type: 'history-updated', projectId: record.projectId, scriptId: record.scriptId })
  const save = (): Promise<void> => store.write({ version: 1, records: structuredClone(records) })
  const ready = (async () => {
    const saved = await store.read()
    const knownProjects = projectIds ? new Set(await projectIds()) : null
    records = saved.records
      .filter((record) => !knownProjects || knownProjects.has(record.projectId))
      .map((record) =>
        record.status === 'running'
          ? {
              ...record,
              status: 'interrupted' as const,
              endedAt: null,
              exitCode: null,
              stopped: false
            }
          : record
      )
    const retained = new Map<string, Map<string, number>>()
    records = records
      .toReversed()
      .filter((record) => {
        const counts = retained.get(record.projectId) ?? new Map<string, number>()
        retained.set(record.projectId, counts)
        const count = counts.get(record.scriptId) ?? 0
        counts.set(record.scriptId, count + 1)
        return count < limit
      })
      .reverse()
    if (JSON.stringify(records) !== JSON.stringify(saved.records)) await save()
    await logs?.prune(records.map((record) => record.runId))
  })().catch((error: unknown) => warn('[history] could not restore run history', error))

  let queue = Promise.resolve()
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const next = queue.then(() => ready).then(action)
    queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }
  const background = (operation: Promise<void>): void => {
    void operation.catch((error: unknown) => warn('[history] could not save run history', error))
  }
  const saveOutput = async (runId: string): Promise<boolean> => {
    dirty.delete(runId)
    const buffer = buffers.get(runId)
    if (buffer && records.some((record) => record.runId === runId)) {
      try {
        await logs?.write(runId, buffer.snapshot())
      } catch (error) {
        // A logging failure must not report an already started script as a failed start.
        dirty.add(runId)
        warn('[history] could not save historical output', error)
        scheduleCheckpoint()
        return false
      }
    }
    return true
  }
  const checkpoint = (): Promise<void> =>
    enqueue(async () => {
      for (const runId of [...dirty]) {
        const saved = await saveOutput(runId)
        if (saved && records.find((record) => record.runId === runId)?.status !== 'running') {
          buffers.delete(runId)
        }
      }
    })
  const scheduleCheckpoint = (): void => {
    if (!logs || timer) return
    timer = setTimeout(() => {
      timer = undefined
      background(checkpoint())
    }, checkpointMs)
    timer.unref()
  }
  const deleteRecords = async (removed: RunRecord[]): Promise<void> => {
    const ids = new Set(removed.map((record) => record.runId))
    const retained = records.filter((record) => !ids.has(record.runId))
    // Remove metadata first; startup pruning finishes cleanup if the process crashes here.
    await store.write({ version: 1, records: structuredClone(retained) })
    records = retained
    for (const runId of ids) {
      buffers.delete(runId)
      dirty.delete(runId)
      await logs?.remove(runId)
    }
    await logs?.prune(records.map((record) => record.runId))
  }
  const recordRun = async (run: Extract<Run, { kind: 'script' }>): Promise<void> => {
    if (removedProjects.has(run.projectId)) {
      buffers.delete(run.id)
      dirty.delete(run.id)
      return
    }
    const previous = records.find((record) => record.runId === run.id)
    if (previous && (previous.status !== 'running' || run.status !== 'exited')) return
    const entry: RunRecord = {
      runId: run.id,
      projectId: run.projectId,
      scriptId: run.scriptId,
      command: run.command,
      startedAt: run.startedAt,
      endedAt: run.status === 'exited' ? (run.endedAt ?? null) : null,
      status: run.status === 'exited' ? 'finished' : 'running',
      exitCode: run.status === 'exited' ? run.exitCode : null,
      stopped: run.status === 'exited' && run.stopped
    }
    if (previous) records[records.indexOf(previous)] = entry
    else records.push(entry)
    if (run.status === 'exited') {
      if (await saveOutput(run.id)) buffers.delete(run.id)
      const ended = records.filter(
        (record) => matches(record, entry) && record.status !== 'running'
      )
      const old = ended.slice(0, Math.max(0, ended.length - limit))
      if (old.length) await deleteRecords(old)
      else await save()
    } else {
      await save()
      // An empty snapshot distinguishes a run without output from an old/missing log.
      await saveOutput(run.id)
    }
    changed(entry)
  }

  subscribe((event) => {
    if (event.type === 'run-updated' && event.run.kind === 'script') {
      if (removedProjects.has(event.run.projectId)) return
      const known = records.find((record) => record.runId === event.run.id)
      if (!buffers.has(event.run.id) && (!known || known.status === 'running')) {
        buffers.set(event.run.id, new HistoryOutput())
      }
      const run = structuredClone(event.run)
      background(enqueue(() => recordRun(run)))
    } else if (event.type === 'run-output') {
      const buffer = buffers.get(event.runId)
      if (!buffer) return
      buffer.append(event.data)
      dirty.add(event.runId)
      scheduleCheckpoint()
    }
  })

  return {
    async list(projectId, scriptId) {
      const target = scope(projectId, scriptId)
      await ready
      await queue
      return structuredClone(
        records.filter((record) => matches(record, target) && record.status !== 'running').reverse()
      )
    },
    async output(projectId, scriptId, rawRunId) {
      const target = scope(projectId, scriptId)
      const runId = id.safeParse(rawRunId)
      if (!runId.success) throw new DevhubError('INVALID_INPUT', '运行 id 无效')
      return enqueue(async () => {
        const record = records.find(
          (candidate) => candidate.runId === runId.data && matches(candidate, target)
        )
        if (!record || record.status === 'running')
          throw new DevhubError('RUN_NOT_FOUND', '历史记录不存在或已清空')
        return logs ? logs.read(record.runId) : null
      })
    },
    clear(projectId, scriptId) {
      const target = scope(projectId, scriptId)
      return enqueue(async () => {
        await deleteRecords(
          records.filter((record) => matches(record, target) && record.status !== 'running')
        )
        changed(target)
      })
    },
    forgetProject(rawProjectId) {
      const projectId = id.safeParse(rawProjectId)
      if (!projectId.success) throw new DevhubError('INVALID_INPUT', '项目 id 无效')
      // Prevent late process events from recreating history after a project is removed.
      removedProjects.add(projectId.data)
      return enqueue(async () => {
        const removed = records.filter((record) => record.projectId === projectId.data)
        await deleteRecords(removed)
        for (const record of removed) changed(record)
      })
    },
    async flush() {
      clearTimeout(timer)
      timer = undefined
      await checkpoint()
      await queue
    }
  }
}
