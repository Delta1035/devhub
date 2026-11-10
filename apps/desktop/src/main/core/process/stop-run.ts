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
export function stopEntry(entry: RunEntry, deps: StopDeps): Promise<void> {
  if (entry.stopPromise) return entry.stopPromise
  if (entry.run.status === 'exited') return entry.exited

  const wasStopped = entry.run.stopped
  let begin = (): void => undefined
  const pending = new Promise<void>((resolve, reject) => {
    begin = () => {
      void stopRunningEntry(entry, deps).then(resolve, reject)
    }
  })
  const attempt = pending
    .catch((error: unknown) => {
      if (entry.run.status !== 'exited') {
        entry.run.status = 'running'
        entry.run.stopped = wasStopped
        announceRun(entry, deps.emit)
      }
      throw error
    })
    .finally(() => {
      entry.stopPromise = undefined
    })
  // Publish the attempt before events or process operations can trigger another stop.
  entry.stopPromise = attempt
  begin()
  return attempt
}

async function stopRunningEntry(entry: RunEntry, deps: StopDeps): Promise<void> {
  const { killer, platform, emit, graceMs, forceTimeoutMs } = deps
  entry.run.status = 'stopping'
  entry.run.stopped = true
  announceRun(entry, emit)
  let stopAnswering = (): void => undefined
  try {
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
    if (!(await settlesWithin(entry.exited, graceMs()))) {
      await killer.forceKill(entry.run.pid)
      // Never leave a run stuck in "stopping" if the exit event is lost.
      if (!(await settlesWithin(entry.exited, forceTimeoutMs))) entry.markExited(null)
    }
  } finally {
    stopAnswering()
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
