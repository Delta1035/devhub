import type { PortConflict } from './domain'

/** "端口 5173 已被 node.exe（PID 1234）占用；端口 8080 已被占用" */
export function describePortConflicts(conflicts: PortConflict[]): string {
  return conflicts
    .map(({ port, pid, processName }) =>
      processName
        ? `端口 ${port} 已被 ${processName}${pid === null ? '' : `（PID ${pid}）`}占用`
        : `端口 ${port} 已被占用`
    )
    .join('；')
}
