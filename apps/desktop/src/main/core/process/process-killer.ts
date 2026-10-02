import { execFile } from 'child_process'
import { readdir, readFile } from 'fs/promises'
import { promisify } from 'util'
import type { PtyProcess } from './pty'

/**
 * Stops a run's whole process tree in two phases: a polite interrupt, then a forced kill.
 *
 * - Windows: Ctrl+C through the console, then `taskkill /T /F` (walks the parent/child tree).
 * - Linux: node-pty makes the child a session leader, so its pid is also the process group
 *   and session id. Signalling `-pid` reaches the group; the forced kill also sweeps the
 *   whole session, because an interactive shell puts each job in a group of its own.
 */
export interface ProcessKiller {
  interrupt(pty: PtyProcess): void
  /**
   * Ends an interactive shell, as closing a terminal window does. Linux: SIGHUP (the shell
   * passes it on to its jobs). Windows has no hang-up signal and Ctrl+C does not end a
   * shell, so the tree is killed right away.
   */
  hangup(pty: PtyProcess): Promise<void>
  forceKill(pid: number): Promise<void>
}

export interface ProcessKillerDeps {
  platform: NodeJS.Platform
  execFile?: (file: string, args: string[]) => Promise<unknown>
  kill?: (pid: number, signal: NodeJS.Signals) => void
  /** Pids whose session id is `sessionId` (Linux, from /proc). */
  listSession?: (sessionId: number) => Promise<number[]>
}

const execFileAsync = promisify(execFile)

export function createProcessKiller({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true }),
  kill = (pid, signal) => process.kill(pid, signal),
  listSession = listSessionFromProc
}: ProcessKillerDeps): ProcessKiller {
  /** Sends a signal, ignoring targets that are already gone. */
  const signal = (target: number, name: NodeJS.Signals): void => {
    try {
      kill(target, name)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }

  if (platform === 'win32') {
    const forceKill = async (pid: number): Promise<void> => {
      try {
        await exec('taskkill', ['/PID', String(pid), '/T', '/F'])
      } catch {
        // Fails when the process already exited; the caller still waits for the exit event
        // and has its own timeout.
      }
    }
    return {
      interrupt: (pty) => pty.write('\x03'),
      hangup: (pty) => forceKill(pty.pid),
      forceKill
    }
  }

  return {
    interrupt: (pty) => signal(-pty.pid, 'SIGTERM'),
    async hangup(pty) {
      signal(-pty.pid, 'SIGHUP')
    },
    async forceKill(pid) {
      signal(-pid, 'SIGKILL')
      for (const member of await listSession(pid).catch(() => [])) signal(member, 'SIGKILL')
    }
  }
}

/** Reads the session id (6th field of /proc/<pid>/stat) of every process. */
async function listSessionFromProc(sessionId: number): Promise<number[]> {
  const pids = (await readdir('/proc')).filter((entry) => /^\d+$/.test(entry))
  const members: number[] = []
  for (const pid of pids) {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => null)
    if (stat !== null && parseSessionId(stat) === sessionId) members.push(Number(pid))
  }
  return members
}

/**
 * `pid (comm) state ppid pgrp session …`. The command name may contain spaces and
 * parentheses, so fields are counted from the last ')'.
 */
export function parseSessionId(stat: string): number | null {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const session = Number(fields[3])
  return Number.isInteger(session) ? session : null
}
