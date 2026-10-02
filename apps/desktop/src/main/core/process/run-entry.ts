import { DevhubError, type DevhubEvent, type Run, type ShellId } from '@devhub/shared'
import type { PtyProcess, PtySpawner } from './pty'
import { RunOutput } from './run-output'

/** What a run executes; becomes the kind-specific half of `Run`. */
export type RunIdentity = { kind: 'script'; scriptId: string } | { kind: 'shell'; shellId: ShellId }

export interface LaunchParams {
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

/** A run together with its live process and output buffer. */
export interface RunEntry {
  run: Run
  pty: PtyProcess
  output: RunOutput
  exited: Promise<void>
  markExited: (exitCode: number | null) => void
}

export interface LaunchDeps {
  spawn: PtySpawner
  emit: (event: DevhubEvent) => void
  outputLimit: number
  outputFlushMs: number
  now: () => Date
  newId: () => string
}

export const snapshotRun = (entry: RunEntry): Run => ({ ...entry.run })

export const announceRun = (entry: RunEntry, emit: (event: DevhubEvent) => void): void =>
  emit({ type: 'run-updated', run: snapshotRun(entry) })

/** Spawns the process and wires its output and exit into a new entry. */
export function launchEntry(params: LaunchParams, deps: LaunchDeps): RunEntry {
  const { spawn, emit, outputLimit, outputFlushMs, now, newId } = deps
  let pty: PtyProcess
  try {
    pty = spawn({ file: params.file, args: params.args, cwd: params.cwd, env: params.env })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new DevhubError('SPAWN_FAILED', `无法启动 ${params.title}：${detail}`)
  }

  let resolveExited = (): void => undefined
  const runId = newId()
  const entry: RunEntry = {
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
      announceRun(entry, emit)
    }
  }

  pty.onData((data) => entry.output.append(data))
  pty.onExit((exitCode) => entry.markExited(exitCode))
  return entry
}
