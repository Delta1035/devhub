import { useState } from 'react'
import { Pencil, Play, Square } from 'lucide-react'
import type { ContinueCondition, Group, GroupRunState, GroupStepState, Run } from '@devhub/shared'
import { access } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useProjects } from '@renderer/features/projects/use-projects'
import { healthLabels, useRunHealth } from '@renderer/features/runs/use-run-health'
import { useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import { GroupEditor } from './group-editor'
import { useGroupStates, useStartGroup, useStopGroup } from './use-groups'

const statusLabels: Record<GroupRunState['status'], string> = {
  running: '执行中',
  done: '已完成',
  failed: '失败',
  stopped: '已停止'
}
const stepLabels: Record<GroupStepState, string> = {
  pending: '等待启动',
  running: '启动中',
  done: '条件满足',
  failed: '失败',
  cancelled: '已取消'
}

function describeCondition(condition: ContinueCondition): string {
  switch (condition.type) {
    case 'delay':
      return `等待 ${condition.seconds} 秒`
    case 'exit':
      return `进程成功退出 · 超时 ${condition.timeoutSeconds} 秒`
    case 'output':
      return `输出${condition.regex ? '匹配正则' : '出现文字'}「${condition.text}」 · 超时 ${condition.timeoutSeconds} 秒`
    case 'port':
      return `端口 ${condition.port} 可连接 · 超时 ${condition.timeoutSeconds} 秒`
    case 'http':
      return `HTTP 返回成功：${condition.url} · 超时 ${condition.timeoutSeconds} 秒`
  }
}

export function GroupDetail({
  group,
  onOpenRun
}: {
  group: Group
  onOpenRun: (run: Run) => void
}): React.JSX.Element {
  const state = useGroupStates().data?.find((candidate) => candidate.groupId === group.id)
  const execution = state?.group ?? group
  const projects = useProjects().data ?? []
  const runs = useRuns().data ?? []
  const health = useRunHealth().data ?? []
  const start = useStartGroup()
  const stop = useStopGroup()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = state?.status === 'running'
  const completed = state?.steps.filter((step) => step.state === 'done').length ?? 0
  const busy = start.isPending || stop.isPending
  const activeRuns = runs.filter(
    (run) =>
      run.kind === 'script' &&
      run.status !== 'exited' &&
      execution.steps.some(
        (step) => step.projectId === run.projectId && step.scriptId === run.scriptId
      )
  )

  return (
    <section aria-label={`任务运行 ${group.name}`} className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-semibold">{group.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {execution.mode === 'parallel' ? '并行' : '串行'} ·{' '}
            {state ? statusLabels[state.status] : '尚未执行'} · {completed}/{execution.steps.length}{' '}
            个步骤完成
          </p>
        </div>
        <Button
          size="sm"
          disabled={busy || running}
          onClick={() =>
            start.mutate(group.id, { onError: (failure) => setError(failure.message) })
          }
        >
          <Play />
          执行
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (!running && activeRuns.length === 0)}
          onClick={() => stop.mutate(group.id, { onError: (failure) => setError(failure.message) })}
        >
          <Square />
          停止全部
        </Button>
        {access.manage && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            编辑
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          停止全部会结束最近执行配置内所有活动脚本，包括复用的运行；使用同一运行的其他任务也会受影响。
        </p>
        {state?.finishedAt && (
          <p className="text-xs text-muted-foreground">
            上次执行结束：{new Date(state.finishedAt).toLocaleString('zh-CN')}
          </p>
        )}
        {state?.status === 'done' && (
          <p className="text-sm">
            步骤已完成，服务进程可能仍在运行。当前有 {activeRuns.length} 个活动脚本。
          </p>
        )}
        {state?.group && JSON.stringify(state.group) !== JSON.stringify(group) && (
          <p className="text-xs text-muted-foreground">
            以下显示上次执行时的步骤；编辑后的配置将在下次执行时生效。
          </p>
        )}
        {state && !state.group && (
          <p className="text-xs text-muted-foreground">
            旧记录未保存执行配置；以下步骤和继续条件来自当前配置，可能与原执行不同。
          </p>
        )}
        <ol className="space-y-3">
          {execution.steps.map((step, index) => {
            const progress = state?.steps.find((candidate) => candidate.stepId === step.id)
            const run = progress?.runId
              ? runs.find((candidate) => candidate.id === progress.runId)
              : undefined
            const readiness =
              run?.status === 'running'
                ? health.find((candidate) => candidate.runId === run.id)
                : undefined
            const processLabel = run
              ? run.status === 'exited'
                ? `已退出（退出码 ${run.exitCode ?? '未知'}）`
                : run.status === 'stopping'
                  ? '停止中'
                  : readiness
                    ? healthLabels[readiness.state]
                    : '运行中'
              : progress?.runId
                ? '运行已不可用'
                : '尚未启动'
            const label =
              progress?.state === 'done' && execution.mode === 'parallel'
                ? '已启动'
                : progress?.state === 'running' && progress.message
                  ? '等待条件'
                  : stepLabels[progress?.state ?? 'pending']
            return (
              <li
                key={step.id}
                aria-label={`运行步骤 ${index + 1}`}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                    {index + 1}.{' '}
                    {projects.find((project) => project.id === step.projectId)?.name ??
                      '（已移除的项目）'}{' '}
                    · {run?.title ?? step.scriptId.slice(step.scriptId.indexOf(':') + 1)}
                  </span>
                  <Badge variant={progress?.state === 'failed' ? 'destructive' : 'secondary'}>
                    {label}
                  </Badge>
                </div>
                <p className="mt-2 break-words text-xs text-muted-foreground">
                  {execution.mode === 'serial'
                    ? `继续条件：${describeCondition(step.continueWhen)}`
                    : '并行启动，无等待条件'}
                </p>
                {progress?.message && (
                  <p
                    className={cn(
                      'mt-2 break-words text-sm',
                      progress.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {progress.message}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span title={readiness?.target}>进程：{processLabel}</span>
                  {progress?.runId && (
                    <span className="text-muted-foreground">
                      {progress.reused === undefined
                        ? '启动来源未记录'
                        : progress.reused
                          ? '复用已有运行'
                          : '本次启动'}
                    </span>
                  )}
                  {run ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => onOpenRun(run)}
                    >
                      查看日志
                    </Button>
                  ) : progress?.runId ? (
                    <span className="ml-auto text-muted-foreground">日志不可用</span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      {editing && <GroupEditor group={group} onClose={() => setEditing(false)} />}
    </section>
  )
}
