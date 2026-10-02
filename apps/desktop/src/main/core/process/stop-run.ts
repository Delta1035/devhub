import type { DevhubEvent } from '@devhub/shared'
import { answerBatchPrompt } from './batch-prompt'
import type { ProcessKiller } from './process-killer'
import { announceRun, type RunEntry } from './run-entry'

export interface StopDeps {
  killer: ProcessKiller
  platform: NodeJS.Platform
  emit: (event: DevhubEvent) => void
  /** How long a run may take to exit after the interrupt before it is force-killed. */
  graceMs: () => number
  /** How long to wait for the exit event after a forced kill before giving up on it. */
  forceTimeoutMs: number
}

/**
 * Stops a run in two phases (ADR 0003): a polite interrupt / hangup, then a forced kill of
 * the whole tree once the grace period runs out. Resolves when the run has exited.
 */
export async function stopEntry(entry: RunEntry, deps: StopDeps): Promise<void> {
  const { killer, platform, emit, graceMs, forceTimeoutMs } = deps
  if (entry.run.status === 'running') {
    entry.run.status = 'stopping'
    entry.run.stopped = true
    announceRun(entry, emit)
    let stopAnswering = (): void => undefined
    // Ctrl+C does not end an interactive shell; hang it up like closing a terminal window.
    if (entry.run.kind === 'shell') await killer.hangup(entry.pty)
    else {
      killer.interrupt(entry.pty)
      if (platform === 'win32') {
        stopAnswering = answerBatchPrompt(
          () => entry.output.snapshot(),
          (data) => entry.pty.write(data)
        )
      }
    }
    try {
      if (!(await settlesWithin(entry.exited, graceMs()))) {
        await killer.forceKill(entry.run.pid)
        // Never leave a run stuck in "stopping" if the exit event is lost.
        if (!(await settlesWithin(entry.exited, forceTimeoutMs))) entry.markExited(null)
      }
    } finally {
      stopAnswering()
    }
  }
  await entry.exited
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
