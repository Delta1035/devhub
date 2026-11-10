import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  hasAncestor,
  protectedPortPids,
  type PortExecFile,
  type PortProcess,
  type ReadPortProcesses
} from './port-processes'

export interface PortProcessTreeDeps {
  platform: NodeJS.Platform
  readProcesses: ReadPortProcesses
  graceMs: number
  pollMs?: number
  forceTimeoutMs?: number
  selfPid?: number
  execFile?: PortExecFile
  kill?: (pid: number, signal: NodeJS.Signals) => void
}

const execFileAsync = promisify(execFile)
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Stops only positively identified PIDs, never a guessed process group such as -listenerPid. */
export function createPortProcessTerminator({
  platform,
  readProcesses,
  graceMs,
  pollMs = 50,
  forceTimeoutMs = 5000,
  selfPid = process.pid,
  execFile: exec = (file, args) => execFileAsync(file, args, { windowsHide: true, timeout: 5000 }),
  kill = (pid, signal) => process.kill(pid, signal)
}: PortProcessTreeDeps): (roots: PortProcess[]) => Promise<void> {
  return async (roots) => {
    if (roots.length === 0) return
    const tracked = new Map<number, PortProcess>()
    const rootIds = new Set(roots.map(({ pid }) => pid))

    const refresh = async (): Promise<Map<number, PortProcess>> => {
      const processes = new Map((await readProcesses()).map((row) => [row.pid, row]))
      const protectedPids = protectedPortPids(selfPid, processes, platform)
      for (const root of roots) {
        const current = processes.get(root.pid)
        if (current && current.identity !== root.identity) {
          throw new Error(`进程 PID ${root.pid} 身份已变化，拒绝结束`)
        }
      }
      const anchors = [...roots, ...tracked.values()]
      for (const row of processes.values()) {
        const belongs = anchors.some((root) => {
          const liveRoot = processes.get(root.pid)
          return liveRoot?.identity === root.identity && hasAncestor(row.pid, root.pid, processes)
        })
        if (!belongs) continue
        if (protectedPids.has(row.pid)) throw new Error(`拒绝结束受保护进程 PID ${row.pid}`)
        if (!row.identity) throw new Error(`无法核验进程 PID ${row.pid} 的启动身份`)
        const previous = tracked.get(row.pid)
        if (previous && previous.identity !== row.identity) {
          throw new Error(`进程 PID ${row.pid} 身份已变化，拒绝结束`)
        }
        tracked.set(row.pid, row)
      }
      return processes
    }

    const initial = await refresh()

    const verify = async (row: PortProcess): Promise<boolean> => {
      const processes = await refresh()
      if (protectedPortPids(selfPid, processes, platform).has(row.pid)) {
        throw new Error(`拒绝结束受保护进程 PID ${row.pid}`)
      }
      const current = processes.get(row.pid)
      if (!current) return false
      if (!row.identity || current.identity !== row.identity) {
        throw new Error(`进程 PID ${row.pid} 身份已变化，拒绝结束`)
      }
      return true
    }

    const alive = async (): Promise<PortProcess[]> => {
      const current = await refresh()
      return [...tracked.values()].filter((row) => current.get(row.pid)?.identity === row.identity)
    }

    const waitForExit = async (timeoutMs: number): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        if ((await alive()).length === 0) return true
        if (Date.now() >= deadline) return false
        await delay(Math.min(pollMs, Math.max(1, deadline - Date.now())))
      }
    }

    const signal = async (row: PortProcess, name: NodeJS.Signals): Promise<void> => {
      if (!(await verify(row))) return
      try {
        kill(row.pid, name)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }

    const taskkill = async (row: PortProcess, force: boolean): Promise<void> => {
      if (!(await verify(row))) return
      try {
        await exec('taskkill', ['/PID', String(row.pid), '/T', ...(force ? ['/F'] : [])])
      } catch (error) {
        // Console programs may require /F. A failed forced termination is never ignored.
        if (force && (await verify(row))) throw error
      }
    }

    const descendantsFirst = (rows: PortProcess[]): PortProcess[] => {
      const map = new Map([...tracked.values()].map((row) => [row.pid, row]))
      const depth = (row: PortProcess): number => {
        const seen = new Set<number>()
        while (map.has(row.parentPid) && !seen.has(row.parentPid)) {
          seen.add(row.parentPid)
          row = map.get(row.parentPid)!
        }
        return seen.size
      }
      return [...rows].sort((left, right) => {
        return depth(right) - depth(left) || left.pid - right.pid
      })
    }

    if (platform === 'win32') {
      for (const root of roots) {
        if (
          !roots.some(
            (other) => other.pid !== root.pid && hasAncestor(root.pid, other.pid, initial)
          )
        ) {
          await taskkill(root, false)
        }
      }
    } else {
      for (const row of descendantsFirst([...tracked.values()])) await signal(row, 'SIGTERM')
    }
    if (await waitForExit(graceMs)) return

    for (const row of descendantsFirst(await alive())) {
      if (platform === 'win32') await taskkill(row, true)
      else await signal(row, 'SIGKILL')
    }
    if (!(await waitForExit(forceTimeoutMs))) {
      throw new Error(`进程树未能退出：${[...rootIds].join('、')}`)
    }
  }
}
