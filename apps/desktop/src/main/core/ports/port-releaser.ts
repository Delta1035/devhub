import { DevhubError, type Script } from '@devhub/shared'
import { checkLocalPort } from '../net/local-port'
import { createPortOwnersFinder, type FindPortOwners, type PortOwner } from './port-owner'
import { createPortProcessTerminator } from './port-process-tree'
import {
  createPortProcessesReader,
  hasAncestor,
  protectedPortPids,
  type PortExecFile,
  type PortProcess,
  type ReadPortProcesses
} from './port-processes'

export interface ManagedPortRun {
  pid: number
  stop: () => Promise<void>
}

export interface PortReleaserDeps {
  platform: NodeJS.Platform
  graceMs?: number | (() => number)
  pollMs?: number
  forceTimeoutMs?: number
  findOwners?: FindPortOwners
  readProcesses?: ReadPortProcesses
  isPortInUse?: (port: number) => Promise<boolean>
  execFile?: PortExecFile
  kill?: (pid: number, signal: NodeJS.Signals) => void
  selfPid?: number
}

export type ReleasePorts = (
  script: Pick<Script, 'ports'>,
  managedRuns?: ManagedPortRun[]
) => Promise<void>

/** A failed release is never an ignorable conflict: starting would target the wrong listener. */
export function createPortReleaser({
  platform,
  graceMs = 5000,
  pollMs = 50,
  forceTimeoutMs = 5000,
  execFile,
  kill,
  selfPid = process.pid,
  findOwners = createPortOwnersFinder({ platform, execFile }),
  readProcesses = createPortProcessesReader({ platform, execFile }),
  isPortInUse = checkLocalPort
}: PortReleaserDeps): ReleasePorts {
  return async (script, managedRuns = []) => {
    const ports = [...new Set(script.ports ?? [])]
    if (ports.length === 0) return
    try {
      if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) {
        throw new Error('脚本包含无效端口')
      }
      const grace = typeof graceMs === 'function' ? graceMs() : graceMs
      if (!Number.isFinite(grace) || grace < 0) throw new Error('停止宽限时间无效')
      const ownersOf = async (port: number): Promise<PortOwner[]> => {
        const owners = await findOwners(port)
        if (owners.length === 0 && (await isPortInUse(port))) {
          throw new Error(`无法确定端口 ${port} 的全部占用进程，请检查权限`)
        }
        return owners
      }
      const owners = new Map<number, PortOwner>()
      for (const port of ports) {
        for (const owner of await ownersOf(port)) owners.set(owner.pid, owner)
      }
      if (owners.size === 0) return
      const processes = new Map((await readProcesses()).map((row) => [row.pid, row]))
      const protectedPids = protectedPortPids(selfPid, processes, platform)
      const managed = new Map<number, ManagedPortRun>()
      const external: PortProcess[] = []
      for (const { pid } of owners.values()) {
        if (protectedPids.has(pid)) throw new Error(`拒绝结束受保护进程 PID ${pid}`)
        const row = processes.get(pid)
        if (!row?.identity) throw new Error(`无法核验端口占用进程 PID ${pid} 的启动身份`)
        const run = managedRuns.find((run) => hasAncestor(pid, run.pid, processes))
        if (run) {
          if (protectedPids.has(run.pid)) throw new Error(`拒绝结束受保护进程 PID ${run.pid}`)
          if (!processes.get(run.pid)?.identity) {
            throw new Error(`无法核验受管进程 PID ${run.pid} 的启动身份`)
          }
          managed.set(run.pid, run)
        } else external.push(row)
      }

      for (const run of managed.values()) {
        const current = new Map((await readProcesses()).map((row) => [row.pid, row]))
        if (current.get(run.pid)?.identity !== processes.get(run.pid)?.identity) {
          throw new Error(`受管进程 PID ${run.pid} 身份已变化，拒绝结束`)
        }
        await run.stop()
      }
      await createPortProcessTerminator({
        platform,
        readProcesses,
        graceMs: grace,
        pollMs,
        forceTimeoutMs,
        selfPid,
        execFile,
        kill
      })(external)

      const deadline = Date.now() + grace
      for (;;) {
        let busy = false
        for (const port of ports) {
          const current = await ownersOf(port)
          if (current.length === 0) continue
          busy = true
          const snapshot = new Map((await readProcesses()).map((row) => [row.pid, row]))
          for (const owner of current) {
            if (
              !owners.has(owner.pid) ||
              snapshot.get(owner.pid)?.identity !== processes.get(owner.pid)?.identity
            ) {
              throw new Error(`端口 ${port} 已被新进程 PID ${owner.pid} 再次占用`)
            }
          }
        }
        if (!busy) return
        if (Date.now() >= deadline) throw new Error(`端口 ${ports.join('、')} 释放超时`)
        await new Promise((resolve) => setTimeout(resolve, pollMs))
      }
    } catch (error) {
      throw new DevhubError(
        'PORT_RELEASE_FAILED',
        `无法释放端口 ${ports.join('、')}：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
