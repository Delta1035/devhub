import { execFile } from 'child_process'
import { promisify } from 'util'
import { z } from 'zod'

export interface PortOwner {
  pid: number
  name: string
}

export type FindPortOwner = (port: number) => Promise<PortOwner | null>
export type FindPortOwners = (port: number) => Promise<PortOwner[]>

export interface PortOwnerDeps {
  platform: NodeJS.Platform
  execFile?: (file: string, args: string[]) => Promise<{ stdout: string }>
}

const execFileAsync = promisify(execFile)
const portSchema = z.number().int().min(1).max(65535)
const ownerSchema = z.object({
  pid: z.number().int().min(1).max(2147483647),
  name: z.string().min(1)
})

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

/** Enumerates every listener; incomplete ownership must never authorize killing only a subset. */
export function createPortOwnersFinder({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true, timeout: 5000 })
}: PortOwnerDeps): FindPortOwners {
  return async (rawPort) => {
    const port = portSchema.parse(rawPort)
    if (platform === 'win32') {
      // Enumerate first: a filtered CIM query reports a missing port as an error, not an empty list.
      const script =
        "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); " +
        `$connections = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $_.State -eq 'Listen' -and $_.LocalPort -eq ${port} }); ` +
        '$owners = @($connections | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction Stop; ' +
        '[PSCustomObject]@{ pid = [int]$_.OwningProcess; name = [string]$p.ProcessName } }); ' +
        'ConvertTo-Json -InputObject $owners -Compress'
      const { stdout } = await exec('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script
      ])
      return parseWindowsOwners(stdout)
    }
    const { stdout } = await exec('ss', ['-ltnpH', `sport = :${port}`])
    return parseSsOwners(stdout)
  }
}

/** The plural PowerShell query always returns a JSON array, including when no port is in use. */
export function parseWindowsOwners(stdout: string): PortOwner[] {
  const owners = z.array(ownerSchema.strict()).parse(JSON.parse(stdout))
  return uniqueOwners(
    owners.map(({ pid, name }) => ({ pid, name: pid <= 4 ? name : `${name}.exe` }))
  )
}

/** Parses every ss row and every process sharing a socket; hidden ownership is an error. */
export function parseSsOwners(stdout: string): PortOwner[] {
  const owners: PortOwner[] = []
  for (const line of stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const fields = /^LISTEN\s+\d+\s+\d+\s+\S+:\d+\s+\S+\s+users:\((.*)\)$/.exec(line.trim())
    if (!fields?.[1]) throw new Error('无法确认端口的全部监听进程')
    const tuples = [...fields[1].matchAll(/\("((?:[^"\\]|\\.)+)",pid=(\d+),fd=\d+\)/g)]
    if (tuples.length === 0 || tuples.map(([tuple]) => tuple).join(',') !== fields[1]) {
      throw new Error('无法确认端口的全部监听进程')
    }
    for (const tuple of tuples) {
      owners.push(ownerSchema.parse({ pid: Number(tuple[2]), name: JSON.parse(`"${tuple[1]}"`) }))
    }
  }
  return uniqueOwners(owners)
}

function uniqueOwners(owners: PortOwner[]): PortOwner[] {
  return [...new Map(owners.map((owner) => [owner.pid, owner])).values()]
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
