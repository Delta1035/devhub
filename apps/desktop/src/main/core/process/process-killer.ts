import { execFile } from 'child_process'
import { promisify } from 'util'
import type { PtyProcess } from './pty'

/**
 * Stops a run's whole process tree in two phases: a polite interrupt, then a forced kill.
 *
 * - Windows: Ctrl+C through the console, then `taskkill /T /F` (walks the parent/child tree).
 * - Linux: node-pty makes the child a session leader, so its pid is also the process group
 *   id; signalling `-pid` reaches every descendant that did not create its own group.
 */
export interface ProcessKiller {
  interrupt(pty: PtyProcess): void
  forceKill(pid: number): Promise<void>
}

export interface ProcessKillerDeps {
  platform: NodeJS.Platform
  execFile?: (file: string, args: string[]) => Promise<unknown>
  kill?: (pid: number, signal: NodeJS.Signals) => void
}

const execFileAsync = promisify(execFile)

export function createProcessKiller({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true }),
  kill = (pid, signal) => process.kill(pid, signal)
}: ProcessKillerDeps): ProcessKiller {
  const signalGroup = (pid: number, signal: NodeJS.Signals): void => {
    try {
      kill(-pid, signal)
    } catch (error) {
      // The group is already gone.
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }

  if (platform === 'win32') {
    return {
      interrupt: (pty) => pty.write('\x03'),
      async forceKill(pid) {
        try {
          await exec('taskkill', ['/PID', String(pid), '/T', '/F'])
        } catch {
          // Fails when the process already exited; the caller still waits for the exit event
          // and has its own timeout.
        }
      }
    }
  }

  return {
    interrupt: (pty) => signalGroup(pty.pid, 'SIGTERM'),
    async forceKill(pid) {
      signalGroup(pid, 'SIGKILL')
    }
  }
}
