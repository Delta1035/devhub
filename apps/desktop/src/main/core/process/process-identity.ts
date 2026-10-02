import { execFile } from 'child_process'
import { readFile } from 'fs/promises'
import { promisify } from 'util'

/**
 * Identifies a process beyond its pid: pids are reused, so a recorded pid alone could point
 * at an unrelated program after a restart. The identity is the process's start time (plus
 * the boot id on Linux), compared exactly.
 */
export type ReadIdentities = (pids: number[]) => Promise<Map<number, string>>

export interface ProcessIdentityDeps {
  platform: NodeJS.Platform
  execFile?: (file: string, args: string[]) => Promise<{ stdout: string }>
  readFile?: (path: string) => Promise<string>
}

const execFileAsync = promisify(execFile)

/** Returns identities of the pids that are alive; missing pids are simply absent. */
export function createIdentityReader({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true }),
  readFile: read = (path) => readFile(path, 'utf8')
}: ProcessIdentityDeps): ReadIdentities {
  if (platform === 'win32') {
    return async (pids) => {
      const identities = new Map<number, string>()
      const ids = pids.filter((pid) => Number.isInteger(pid) && pid > 0)
      if (ids.length === 0) return identities
      // One PowerShell for all pids; they are validated integers, so nothing is injected.
      const script =
        `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | ` +
        'ForEach-Object { "$($_.Id) $($_.StartTime.ToUniversalTime().Ticks)" }; ' +
        // A missing pid still sets a failing exit code even with SilentlyContinue, which
        // would make execFile reject and drop the valid output of the other pids.
        'exit 0'
      const { stdout } = await exec('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script
      ]).catch(() => ({ stdout: '' }))
      for (const line of stdout.split(/\r?\n/)) {
        const match = /^(\d+) (\d+)$/.exec(line.trim())
        if (match?.[1] && match[2]) identities.set(Number(match[1]), match[2])
      }
      return identities
    }
  }

  return async (pids) => {
    const identities = new Map<number, string>()
    const bootId = (await read('/proc/sys/kernel/random/boot_id').catch(() => '')).trim()
    for (const pid of pids) {
      const stat = await read(`/proc/${pid}/stat`).catch(() => null)
      const startTime = stat === null ? null : parseStartTime(stat)
      if (startTime !== null) identities.set(pid, `${bootId}:${startTime}`)
    }
    return identities
  }
}

/** Field 22 of /proc/<pid>/stat (start time in clock ticks since boot), counted after ')'. */
export function parseStartTime(stat: string): string | null {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const startTime = fields[19]
  return startTime && /^\d+$/.test(startTime) ? startTime : null
}
