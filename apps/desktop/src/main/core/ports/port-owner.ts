import { execFile } from 'child_process'
import { promisify } from 'util'

export interface PortOwner {
  pid: number
  name: string
}

export type FindPortOwner = (port: number) => Promise<PortOwner | null>

export interface PortOwnerDeps {
  platform: NodeJS.Platform
  execFile?: (file: string, args: string[]) => Promise<{ stdout: string }>
}

const execFileAsync = promisify(execFile)

/**
 * Which process listens on a local TCP port, so a conflict message can say who holds it.
 * Best effort: null when the OS does not tell us (tool missing, another user's process).
 */
export function createPortOwnerFinder({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true })
}: PortOwnerDeps): FindPortOwner {
  return async (port) => {
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    try {
      if (platform === 'win32') {
        // The port is a validated integer, so nothing can be injected into the script.
        const script =
          `$c = Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
          `if ($c) { $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; "$($c.OwningProcess) $($p.ProcessName)" }; exit 0`
        const { stdout } = await exec('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          script
        ])
        return parseWindowsOwner(stdout)
      }
      const { stdout } = await exec('ss', ['-ltnpH', `sport = :${port}`])
      return parseSsOwner(stdout)
    } catch {
      return null
    }
  }
}

/** `"1234 node"` → { pid: 1234, name: 'node.exe' }; System (pid 4) has no .exe. */
export function parseWindowsOwner(stdout: string): PortOwner | null {
  const match = /^(\d+)(?:\s+(\S+))?/m.exec(stdout.trim())
  if (!match?.[1]) return null
  const pid = Number(match[1])
  const name = match[2] ? (pid <= 4 ? match[2] : `${match[2]}.exe`) : '未知进程'
  return { pid, name }
}

/** `... users:(("node",pid=1234,fd=23))` from `ss -ltnp`. */
export function parseSsOwner(stdout: string): PortOwner | null {
  const match = /users:\(\("([^"]+)",pid=(\d+)/.exec(stdout)
  return match?.[1] && match[2] ? { pid: Number(match[2]), name: match[1] } : null
}
