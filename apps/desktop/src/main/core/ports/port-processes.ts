import { execFile } from 'child_process'
import { readdir, readFile } from 'fs/promises'
import { promisify } from 'util'
import { z } from 'zod'

export interface PortProcess {
  pid: number
  parentPid: number
  /** Null when the OS lists the process but withholds its creation time. */
  identity: string | null
}

export type ReadPortProcesses = () => Promise<PortProcess[]>
export type PortExecFile = (file: string, args: string[]) => Promise<{ stdout: string }>

export interface PortProcessesDeps {
  platform: NodeJS.Platform
  execFile?: PortExecFile
  readFile?: (path: string) => Promise<string>
  readdir?: (path: string) => Promise<string[]>
}

const execFileAsync = promisify(execFile)
const windowsProcesses = z.array(
  z.object({
    pid: z.number().int().positive(),
    parentPid: z.number().int().nonnegative(),
    identity: z.string().regex(/^\d+$/).nullable()
  })
)

/** Parent links and creation times are read together, without treating a PID as a group ID. */
export function createPortProcessesReader({
  platform,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true, timeout: 5000 }),
  readFile: read = (path) => readFile(path, 'utf8'),
  readdir: list = (path) => readdir(path)
}: PortProcessesDeps): ReadPortProcesses {
  if (platform === 'win32') {
    return async () => {
      const script =
        '$ErrorActionPreference = "Stop"; ' +
        '$rows = @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -gt 0 } | ' +
        'ForEach-Object { $created = if ($null -eq $_.CreationDate) { $null } else { ' +
        '$_.CreationDate.ToUniversalTime().Ticks.ToString() }; ' +
        '[pscustomobject]@{ pid = [int]$_.ProcessId; parentPid = [int]$_.ParentProcessId; ' +
        'identity = $created } }); ConvertTo-Json -InputObject $rows -Compress; exit 0'
      const { stdout } = await exec('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        script
      ])
      return windowsProcesses.parse(JSON.parse(stdout))
    }
  }
  return async () => {
    if (platform !== 'linux') throw new Error(`不支持自动释放端口的平台：${platform}`)
    const bootId = (await read('/proc/sys/kernel/random/boot_id')).trim()
    if (!bootId) throw new Error('无法读取系统启动标识')
    const names = (await list('/proc')).filter((name) => /^[1-9]\d*$/.test(name))
    const rows = await Promise.all(
      names.map(async (name) => {
        let stat: string
        try {
          stat = await read(`/proc/${name}/stat`)
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code
          if (code === 'ENOENT' || code === 'ESRCH') return null
          throw error
        }
        return parsePortProcessStat(stat, bootId)
      })
    )
    return rows.filter((row) => row !== null)
  }
}

export function parsePortProcessStat(stat: string, bootId: string): PortProcess | null {
  const pid = Number(stat.slice(0, stat.indexOf(' ')))
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const parentPid = Number(fields[1])
  const identity = fields[19]
  if (
    !Number.isInteger(pid) ||
    pid <= 0 ||
    !Number.isInteger(parentPid) ||
    parentPid < 0 ||
    !identity ||
    !/^\d+$/.test(identity) ||
    !fields[0] ||
    !/^[A-Za-z]$/.test(fields[0])
  ) {
    throw new Error('系统返回了无法识别的进程信息')
  }
  // Zombies hold no sockets and cannot be terminated; their parent still has to reap them.
  if (fields[0] === 'Z' || fields[0] === 'X') return null
  return { pid, parentPid, identity: `${bootId}:${identity}` }
}

export function hasAncestor(
  pid: number,
  ancestor: number,
  processes: ReadonlyMap<number, PortProcess>
): boolean {
  const visited = new Set<number>()
  while (pid > 0 && !visited.has(pid)) {
    if (pid === ancestor) return true
    visited.add(pid)
    pid = processes.get(pid)?.parentPid ?? 0
  }
  return false
}

export function protectedPortPids(
  selfPid: number,
  processes: ReadonlyMap<number, PortProcess>,
  platform: NodeJS.Platform
): Set<number> {
  const protectedPids = new Set(platform === 'win32' ? [0, 1, 2, 3, 4] : [0, 1])
  let pid = selfPid
  while (pid > 0 && !protectedPids.has(pid)) {
    protectedPids.add(pid)
    const process = processes.get(pid)
    if (!process) {
      // Windows retains a child's original parent PID after that parent exits.
      if (platform === 'win32') break
      throw new Error(`无法核验应用的祖先进程 PID ${pid}`)
    }
    pid = process.parentPid
  }
  return protectedPids
}
