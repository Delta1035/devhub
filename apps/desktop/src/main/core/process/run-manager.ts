import { randomUUID } from 'crypto'
import { resolve } from 'path'
import { z } from 'zod'
import {
  DevhubError,
  describePortConflicts,
  shellIdSchema,
  type DevhubEvent,
  type Run,
  type PortConflict,
  type RunOutputSnapshot,
  type Script
} from '@devhub/shared'
import { isDirectory as isDirectoryOnDisk } from '../fs/is-directory'
import type { ProjectService } from '../projects/project-service'
import type { ScriptService } from '../scripts/script-service'
import type { ShellLocator } from '../shells/shell-locator'
import type { ProcessKiller } from './process-killer'
import { shellInvocation, type PtySpawner } from './pty'
import {
  announceRun,
  launchEntry,
  snapshotRun,
  type LaunchParams,
  type RunEntry
} from './run-entry'
import { stopEntry as stopRunEntry } from './stop-run'

export interface RunManager {
  start(projectId: unknown, scriptId: unknown, options?: unknown): Promise<Run>
  /** Opens an interactive shell in the project directory; the default shell when omitted. */
  startShell(projectId: unknown, shellId?: unknown): Promise<Run>
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
  /** Ports the script needs that are taken; checked before starting it. */
  portConflicts?: (script: Script) => Promise<PortConflict[]>
  projects: Pick<ProjectService, 'get'>
  shells: ShellLocator
  isDirectory?: (path: string) => Promise<boolean>
  spawn: PtySpawner
  killer: ProcessKiller
  platform: NodeJS.Platform
  /** Receives run lifecycle and output events for connected UIs. */
  emit?: (event: DevhubEvent) => void
  env?: NodeJS.ProcessEnv
  /** How long a run may take to exit after the interrupt before it is force-killed. */
  /** A function is read at each stop, so a changed setting applies to the next stop. */
  graceMs?: number | (() => number)
  /** How long to wait for the exit event after a forced kill before giving up on it. */
  forceTimeoutMs?: number
  outputLimit?: number
  outputFlushMs?: number
  now?: () => Date
  newId?: () => string
}

const idInput = z.string().min(1)
const startOptions = z.object({ ignorePortConflicts: z.boolean().optional() })
// Keystrokes and pastes; generous but bounded.
const inputData = z.string().max(64 * 1024)
const terminalSize = z.object({
  cols: z.number().int().min(2).max(1000),
  rows: z.number().int().min(1).max(500)
})

export function createRunManager({
  scripts,
  portConflicts = async () => [],
  projects,
  shells,
  isDirectory = isDirectoryOnDisk,
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
  const entries = new Map<string, RunEntry>()

  const getEntry = (rawId: unknown): RunEntry => {
    const parsed = idInput.safeParse(rawId)
    const entry = parsed.success ? entries.get(parsed.data) : undefined
    if (!entry) throw new DevhubError('RUN_NOT_FOUND', '运行记录不存在')
    return entry
  }

  const getActiveEntry = (rawId: unknown): RunEntry => {
    const entry = getEntry(rawId)
    if (entry.run.status === 'exited') throw new DevhubError('RUN_NOT_ACTIVE', '进程已结束')
    return entry
  }

  const launch = (params: LaunchParams): Run => {
    const entry = launchEntry(params, { spawn, emit, outputLimit, outputFlushMs, now, newId })
    entries.set(entry.run.id, entry)
    announceRun(entry, emit)
    return snapshotRun(entry)
  }

  const start = async (
    projectId: unknown,
    scriptId: unknown,
    rawOptions?: unknown
  ): Promise<Run> => {
    const { project, script } = await scripts.find(projectId, scriptId)
    const options = startOptions.safeParse(rawOptions ?? {})
    if (!options.success) throw new DevhubError('INVALID_INPUT', '启动选项无效')

    // Keep only the latest run per script: an active one blocks, an exited one is replaced.
    const previous = [...entries.values()].filter(
      ({ run }) =>
        run.kind === 'script' && run.projectId === project.id && run.scriptId === script.id
    )
    if (previous.some(({ run }) => run.status !== 'exited')) {
      throw new DevhubError('SCRIPT_ALREADY_RUNNING', `${script.name} 已在运行`)
    }

    if (!options.data.ignorePortConflicts) {
      const conflicts = await portConflicts(script)
      if (conflicts.length > 0) {
        throw new DevhubError(
          'PORT_IN_USE',
          `无法启动 ${script.name}：${describePortConflicts(conflicts)}`
        )
      }
    }

    for (const { run } of previous) {
      entries.delete(run.id)
      emit({ type: 'run-removed', runId: run.id })
    }

    const runEnv = definedEnv(env)
    return launch({
      projectId: project.id,
      identity: { kind: 'script', scriptId: script.id },
      title: script.name,
      command: script.command,
      ...shellInvocation(script.command, platform, runEnv),
      cwd: script.cwd ? resolve(project.path, script.cwd) : project.path,
      env: runEnv
    })
  }

  const startShell = async (projectId: unknown, rawShellId?: unknown): Promise<Run> => {
    const project = await projects.get(projectId)
    if (!(await isDirectory(project.path))) {
      throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${project.path}`)
    }
    const requested = rawShellId === undefined ? null : shellIdSchema.safeParse(rawShellId)
    if (requested && !requested.success) throw new DevhubError('INVALID_INPUT', '不支持的终端类型')

    const installed = await shells.list()
    const shell = requested ? installed.find((s) => s.id === requested.data) : installed[0]
    if (!shell) throw new DevhubError('SHELL_NOT_FOUND', '未检测到可用的终端程序')
    try {
      await shells.prepare(shell)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new DevhubError('SPAWN_FAILED', `无法准备 ${shell.name} 的启动文件：${detail}`)
    }

    return launch({
      projectId: project.id,
      identity: { kind: 'shell', shellId: shell.id },
      title: `终端 ${nextShellNumber(project.id)}`,
      command: shell.file,
      file: shell.file,
      args: shell.args,
      cwd: project.path,
      env: { ...definedEnv(env), ...shell.env }
    })
  }

  /** Lowest number not used by this project's open shells: 终端 1, 终端 2, … */
  const nextShellNumber = (projectId: string): number => {
    const used = new Set(
      [...entries.values()]
        .filter(({ run }) => run.kind === 'shell' && run.projectId === projectId)
        .map(({ run }) => Number(/(\d+)$/.exec(run.title)?.[1]))
    )
    let number = 1
    while (used.has(number)) number++
    return number
  }

  const stopDeps = {
    killer,
    platform,
    emit,
    graceMs: () => (typeof graceMs === 'function' ? graceMs() : graceMs),
    forceTimeoutMs
  }
  const stopEntry = (entry: RunEntry): Promise<void> => stopRunEntry(entry, stopDeps)

  return {
    start,

    startShell,

    async stop(runId) {
      await stopEntry(getEntry(runId))
    },

    async restart(runId) {
      const entry = getEntry(runId)
      await stopEntry(entry)
      const { run } = entry
      return run.kind === 'script'
        ? // Its own port was just released; another taker in between surfaces in the output.
          start(run.projectId, run.scriptId, { ignorePortConflicts: true })
        : startShell(run.projectId, run.shellId)
    },

    list: () => [...entries.values()].map(snapshotRun),

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

function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) result[key] = value
  }
  return result
}
