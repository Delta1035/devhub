import type { Run } from '@devhub/shared'

export type RunTone = 'running' | 'pending' | 'failed' | 'idle'

/** What a script row shows about its latest run. */
export function describeRun(run: Run | undefined): { label: string; tone: RunTone } {
  if (!run) return { label: '未运行', tone: 'idle' }
  if (run.status === 'running') return { label: '运行中', tone: 'running' }
  if (run.status === 'stopping') return { label: '正在停止', tone: 'pending' }
  if (run.stopped) return { label: '已停止', tone: 'idle' }
  if (run.exitCode === 0) return { label: '已结束', tone: 'idle' }
  return {
    label: run.exitCode === null ? '异常退出' : `退出码 ${run.exitCode}`,
    tone: 'failed'
  }
}

export function isActive(run: Run | undefined): boolean {
  return run?.status === 'running' || run?.status === 'stopping'
}

/** The core keeps one run per script (ADR 0003); index them by script id. */
export function runsByScript(runs: readonly Run[], projectId: string): Map<string, Run> {
  const byScript = new Map<string, Run>()
  for (const run of runs) {
    if (run.kind === 'script' && run.projectId === projectId) byScript.set(run.scriptId, run)
  }
  return byScript
}

/** Projects with a running or stopping script, for the project list. */
export function activeProjectIds(runs: readonly Run[]): Set<string> {
  return new Set(
    runs.filter((run) => run.kind === 'script' && isActive(run)).map((run) => run.projectId)
  )
}
