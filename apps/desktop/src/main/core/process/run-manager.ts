import { randomUUID } from 'crypto'
import { resolve } from 'path'
import { z } from 'zod'
import {
  DevhubError,
  shellIdSchema,
  type DevhubEvent,
  type Run,
  type RunOutputSnapshot,
  type ShellId
} from '@devhub/shared'
import { isDirectory as isDirectoryOnDisk } from '../fs/is-directory'
import type { ProjectService } from '../projects/project-service'
import type { ScriptService } from '../scripts/script-service'
import type { ShellLocator } from '../shells/shell-locator'
import type { ProcessKiller } from './process-killer'
import { shellInvocation, type PtyProcess, type PtySpawner } from './pty'
import { RunOutput } from './run-output'

export interface RunManager {
  start(projectId: unknown, scriptId: unknown): Promise<Run>
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
  graceMs?: number
  /** How long to wait for the exit event after a forced kill before giving up on it. */
  forceTimeoutMs?: number
  outputLimit?: number
  outputFlushMs?: number
  now?: () => Date
  newId?: () => string
}

/** What a run executes; becomes the kind-specific half of `Run`. */
type RunIdentity = { kind: 'script'; scriptId: string } | { kind: 'shell'; shellId: ShellId }

interface LaunchParams {
  projectId: string
  identity: RunIdentity
  title: string
  /** Shown to the user: the script's command line or the shell executable. */
  command: string
  file: string
  args: string | string[]
  cwd: string
  env: Record<string, string>
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

  const launch = (params: LaunchParams): Run => {
    let pty: PtyProcess
    try {
      pty = spawn({ file: params.file, args: params.args, cwd: params.cwd, env: params.env })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new DevhubError('SPAWN_FAILED', `无法启动 ${params.title}：${detail}`)
    }

    let resolveExited = (): void => undefined
    const runId = newId()
    const entry: Entry = {
      run: {
        id: runId,
        projectId: params.projectId,
        title: params.title,
        command: params.command,
        status: 'running',
        pid: pty.pid,
        exitCode: null,
        stopped: false,
        startedAt: now().toISOString(),
        ...params.identity
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

  const start = async (projectId: unknown, scriptId: unknown): Promise<Run> => {
    const { project, script } = await scripts.find(projectId, scriptId)

    // Keep only the latest run per script: an active one blocks, an exited one is replaced.
    for (const [id, entry] of entries) {
      const { run } = entry
      if (run.kind !== 'script' || run.projectId !== project.id || run.scriptId !== script.id) {
        continue
      }
      if (run.status !== 'exited') {
        throw new DevhubError('SCRIPT_ALREADY_RUNNING', `${script.name} 已在运行`)
      }
      entries.delete(id)
      emit({ type: 'run-removed', runId: id })
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

  const stopEntry = async (entry: Entry): Promise<void> => {
    if (entry.run.status === 'running') {
      entry.run.status = 'stopping'
      entry.run.stopped = true
      announce(entry)
      // Ctrl+C does not end an interactive shell; hang it up like closing a terminal window.
      if (entry.run.kind === 'shell') await killer.hangup(entry.pty)
      else killer.interrupt(entry.pty)
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

    startShell,

    async stop(runId) {
      await stopEntry(getEntry(runId))
    },

    async restart(runId) {
      const entry = getEntry(runId)
      await stopEntry(entry)
      const { run } = entry
      return run.kind === 'script'
        ? start(run.projectId, run.scriptId)
        : startShell(run.projectId, run.shellId)
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
