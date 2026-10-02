import { randomUUID } from 'crypto'
import { resolve } from 'path'
import { z } from 'zod'
import { DevhubError, type DevhubEvent, type Run, type RunOutputSnapshot } from '@devhub/shared'
import type { ScriptService } from '../scripts/script-service'
import type { ProcessKiller } from './process-killer'
import type { PtyProcess, PtySpawner } from './pty'
import { RunOutput } from './run-output'

export interface RunManager {
  start(projectId: unknown, scriptId: unknown): Promise<Run>
  stop(runId: unknown): Promise<void>
  restart(runId: unknown): Promise<Run>
  list(): Run[]
  /** Recent raw output (ANSI codes included), capped at `outputLimit` characters. */
  output(runId: unknown): RunOutputSnapshot
  writeInput(runId: unknown, data: unknown): void
  resize(runId: unknown, cols: unknown, rows: unknown): void
  /** Forgets an exited run. */
  remove(runId: unknown): void
  /** Stops every active run; used when DevHub quits so no orphans are left behind. */
  dispose(): Promise<void>
}

export interface RunManagerDeps {
  scripts: Pick<ScriptService, 'find'>
  spawn: PtySpawner
  killer: ProcessKiller
  platform: NodeJS.Platform
  /** Receives run lifecycle and output events for connected UIs. */
  emit?: (event: DevhubEvent) => void
  env?: NodeJS.ProcessEnv
  /** How long a run may take to exit after the interrupt before it is force-killed. */
  graceMs?: number
  /** How long to wait for the exit event after a forced kill before giving up on it. */
  forceTimeoutMs?: number
  outputLimit?: number
  outputFlushMs?: number
  now?: () => Date
  newId?: () => string
}

interface Entry {
  run: Run
  pty: PtyProcess
  output: RunOutput
  exited: Promise<void>
  markExited: (exitCode: number | null) => void
}

const idInput = z.string().min(1)
// Keystrokes and pastes; generous but bounded.
const inputData = z.string().max(64 * 1024)
const terminalSize = z.object({
  cols: z.number().int().min(2).max(1000),
  rows: z.number().int().min(1).max(500)
})

export function createRunManager({
  scripts,
  spawn,
  killer,
  platform,
  emit = () => undefined,
  env = process.env,
  graceMs = 5000,
  forceTimeoutMs = 5000,
  outputLimit = 512 * 1024,
  outputFlushMs = 16,
  now = () => new Date(),
  newId = randomUUID
}: RunManagerDeps): RunManager {
  const entries = new Map<string, Entry>()

  const getEntry = (rawId: unknown): Entry => {
    const parsed = idInput.safeParse(rawId)
    const entry = parsed.success ? entries.get(parsed.data) : undefined
    if (!entry) throw new DevhubError('RUN_NOT_FOUND', '运行记录不存在')
    return entry
  }

  const snapshot = (entry: Entry): Run => ({ ...entry.run })
  const announce = (entry: Entry): void => emit({ type: 'run-updated', run: snapshot(entry) })

  const getActiveEntry = (rawId: unknown): Entry => {
    const entry = getEntry(rawId)
    if (entry.run.status === 'exited') throw new DevhubError('RUN_NOT_ACTIVE', '进程已结束')
    return entry
  }

  const start = async (projectId: unknown, scriptId: unknown): Promise<Run> => {
    const { project, script } = await scripts.find(projectId, scriptId)

    // Keep only the latest run per script: an active one blocks, an exited one is replaced.
    for (const [id, entry] of entries) {
      if (entry.run.projectId !== project.id || entry.run.scriptId !== script.id) continue
      if (entry.run.status !== 'exited') {
        throw new DevhubError('SCRIPT_ALREADY_RUNNING', `${script.name} 已在运行`)
      }
      entries.delete(id)
      emit({ type: 'run-removed', runId: id })
    }

    let pty: PtyProcess
    try {
      pty = spawn({
        command: script.command,
        cwd: script.cwd ? resolve(project.path, script.cwd) : project.path,
        env: definedEnv(env),
        platform
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new DevhubError('SPAWN_FAILED', `无法启动 ${script.name}：${detail}`)
    }

    let resolveExited = (): void => undefined
    const runId = newId()
    const entry: Entry = {
      run: {
        id: runId,
        projectId: project.id,
        scriptId: script.id,
        scriptName: script.name,
        command: script.command,
        status: 'running',
        pid: pty.pid,
        exitCode: null,
        stopped: false,
        startedAt: now().toISOString()
      },
      pty,
      output: new RunOutput({
        limit: outputLimit,
        flushMs: outputFlushMs,
        onFlush: (offset, data) => emit({ type: 'run-output', runId, offset, data })
      }),
      exited: new Promise((resolveFn) => (resolveExited = resolveFn)),
      markExited: (exitCode) => {
        if (entry.run.status === 'exited') return
        // Last output first, so the UI shows it before the "exited" state.
        entry.output.flush()
        entry.run.status = 'exited'
        entry.run.exitCode = exitCode
        entry.run.endedAt = now().toISOString()
        resolveExited()
        announce(entry)
      }
    }

    pty.onData((data) => entry.output.append(data))
    pty.onExit((exitCode) => entry.markExited(exitCode))
    entries.set(runId, entry)
    announce(entry)
    return snapshot(entry)
  }

  const stopEntry = async (entry: Entry): Promise<void> => {
    if (entry.run.status === 'running') {
      entry.run.status = 'stopping'
      entry.run.stopped = true
      announce(entry)
      killer.interrupt(entry.pty)
      if (!(await settlesWithin(entry.exited, graceMs))) {
        await killer.forceKill(entry.run.pid)
        // Never leave a run stuck in "stopping" if the exit event is lost.
        if (!(await settlesWithin(entry.exited, forceTimeoutMs))) entry.markExited(null)
      }
    }
    await entry.exited
  }

  return {
    start,

    async stop(runId) {
      await stopEntry(getEntry(runId))
    },

    async restart(runId) {
      const entry = getEntry(runId)
      await stopEntry(entry)
      return start(entry.run.projectId, entry.run.scriptId)
    },

    list: () => [...entries.values()].map(snapshot),

    output: (runId) => getEntry(runId).output.snapshot(),

    writeInput(runId, rawData) {
      const entry = getActiveEntry(runId)
      const data = inputData.safeParse(rawData)
      if (!data.success) throw new DevhubError('INVALID_INPUT', '输入内容无效或过长')
      entry.pty.write(data.data)
    },

    resize(runId, cols, rows) {
      const entry = getEntry(runId)
      const size = terminalSize.safeParse({ cols, rows })
      if (!size.success) throw new DevhubError('INVALID_INPUT', '终端尺寸无效')
      if (entry.run.status === 'exited') return
      try {
        entry.pty.resize(size.data.cols, size.data.rows)
      } catch {
        // The process may exit between the status check and the resize; nothing to do.
      }
    },

    remove(runId) {
      const entry = getEntry(runId)
      if (entry.run.status !== 'exited') {
        throw new DevhubError('RUN_STILL_ACTIVE', '请先停止该进程')
      }
      entries.delete(entry.run.id)
      emit({ type: 'run-removed', runId: entry.run.id })
    },

    async dispose() {
      await Promise.all([...entries.values()].map(stopEntry))
    }
  }
}

/** Resolves true if `promise` settles within `ms`, false on timeout. */
async function settlesWithin(promise: Promise<void>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<false>((resolveFn) => (timer = setTimeout(resolveFn, ms, false)))
  try {
    return await Promise.race([promise.then(() => true), timeout])
  } finally {
    clearTimeout(timer)
  }
}

function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) result[key] = value
  }
  return result
}
