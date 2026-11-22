import { useState } from 'react'
import { Pencil, Play, RotateCcw, Square } from 'lucide-react'
import { activeGroups, formatDuration, type Group, type Run } from '@devhub/shared'
import { access } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useProjects } from '@renderer/features/projects/use-projects'
import { useRunHealth } from '@renderer/features/runs/use-run-health'
import { useRuns } from '@renderer/features/runs/use-runs'
import { useNow } from '@renderer/lib/use-now'
import { cn } from '@renderer/lib/utils'
import { GroupEditor } from './group-editor'
import { GroupOutputPanel } from './group-output-panel'
import { GroupProgressBar } from './group-progress-bar'
import { resolveGroupStatus } from './group-status'
import { GroupStepCard } from './group-step-card'
import { useGroupStates, useStartGroup, useStopGroup } from './use-groups'

export function GroupDetail({
  group,
  onOpenRun
}: {
  group: Group
  onOpenRun: (run: Run) => void
}): React.JSX.Element {
  const allStates = useGroupStates().data ?? []
  const state = allStates.find((candidate) => candidate.groupId === group.id)
  const execution = state?.group ?? group
  const projects = useProjects().data ?? []
  const runs = useRuns().data ?? []
  const health = useRunHealth().data ?? []
  const active = activeGroups(allStates, runs).find((candidate) => candidate.groupId === group.id)
  const presentation = resolveGroupStatus({ group, state, active })
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
  const now = useNow(running || activeRuns.length > 0)

  // Calculate overall group elapsed time
  let groupDurationMs: number | null = null
  const stepRunTimes = execution.steps
    .map((step) => {
      const prog = state?.steps.find((s) => s.stepId === step.id)
      const r = prog?.runId ? runs.find((candidate) => candidate.id === prog.runId) : undefined
      return r?.startedAt ? Date.parse(r.startedAt) : null
    })
    .filter((t): t is number => t !== null && !Number.isNaN(t))

  if (stepRunTimes.length > 0) {
    const earliestStart = Math.min(...stepRunTimes)
    const latestEnd = state?.finishedAt ? Date.parse(state.finishedAt) : now
    if (!Number.isNaN(latestEnd) && latestEnd >= earliestStart) {
      groupDurationMs = latestEnd - earliestStart
    }
  }

  const stepStates = execution.steps.map(
    (step) => state?.steps.find((s) => s.stepId === step.id)?.state ?? 'pending'
  )

  const isParallel = execution.mode === 'parallel'

  return (
    <section
      aria-label={`任务运行 ${group.name}`}
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      {/* Redesigned modern header aligned with prototype */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card/40 px-4 py-3 md:px-6 md:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate font-heading text-base font-semibold text-foreground md:text-lg">
              {group.name}
            </h2>

            {/* Run status badge */}
            <Badge
              variant={
                presentation.phase === 'failed'
                  ? 'destructive'
                  : presentation.isActive
                    ? 'default'
                    : 'secondary'
              }
              className={cn(
                'h-5 gap-1.5 px-2 text-[10px]',
                presentation.isActive &&
                  'border-transparent bg-accent/15 text-accent hover:bg-accent/20'
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  presentation.dotState === 'starting' && 'animate-pulse bg-accent',
                  presentation.dotState === 'running' && 'bg-accent',
                  presentation.dotState === 'failed' && 'bg-destructive',
                  (presentation.dotState === 'done' || presentation.dotState === 'idle') &&
                    'bg-muted-foreground'
                )}
              />
              {presentation.detailBadgeText}
            </Badge>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{isParallel ? '并行模式' : '串行模式'}</span>
            <span>·</span>
            <span>
              {completed}/{execution.steps.length} 个步骤完成
            </span>
            {groupDurationMs !== null && (
              <>
                <span>·</span>
                <span className="font-mono">已运行 {formatDuration(groupDurationMs)}</span>
              </>
            )}
            <span>·</span>
            <span>触发方式：手动</span>
          </p>
        </div>

        {/* Action button controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy || running}
            onClick={() =>
              start.mutate(group.id, { onError: (failure) => setError(failure.message) })
            }
            className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Play className="size-3.5 fill-current" />
            执行
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={busy || (!running && activeRuns.length === 0)}
            onClick={() =>
              stop.mutate(group.id, { onError: (failure) => setError(failure.message) })
            }
            className={cn(
              'h-8 gap-1.5',
              running || activeRuns.length > 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
                : 'border-border'
            )}
          >
            <Square className="size-3.5" />
            停止全部
          </Button>

          {state?.status === 'failed' && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy || running}
              onClick={() =>
                start.mutate(group.id, { onError: (failure) => setError(failure.message) })
              }
              className="h-8 gap-1.5 border-border"
            >
              <RotateCcw className="size-3.5" />
              重试
            </Button>
          )}

          {access.manage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="h-8 gap-1.5 border-border text-foreground hover:bg-secondary"
            >
              <Pencil className="size-3.5" />
              编辑
            </Button>
          )}
        </div>
      </header>

      {/* Segmented Progress Bar */}
      <GroupProgressBar
        completedCount={completed}
        totalCount={execution.steps.length}
        stepStates={stepStates}
        durationText={groupDurationMs !== null ? formatDuration(groupDurationMs) : null}
        statusHint={presentation.progressHint}
      />

      {/* Main body scrollable area */}
      <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground/80">
          停止全部会结束最近执行配置内所有活动脚本，包括复用的运行；使用同一运行的其他任务也会受影响。
        </p>

        {state?.finishedAt && (
          <p className="text-xs text-muted-foreground">
            上次执行结束：{new Date(state.finishedAt).toLocaleString('zh-CN')}
          </p>
        )}

        {presentation.phase === 'running' && (
          <p className="rounded-md border border-accent/20 bg-accent/5 p-3 text-sm text-foreground">
            步骤已就绪，服务进程正在运行中。当前有 {activeRuns.length} 个活动脚本。
          </p>
        )}

        {presentation.phase === 'done' && (
          <p className="rounded-md border border-border/80 bg-muted/40 p-3 text-sm text-muted-foreground">
            上次执行步骤已完成，相关服务均已停止。
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

        {/* Group timeline step list */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span>{isParallel ? '并行 · 所有脚本同时启动' : '串行 · 按序执行并等待条件满足'}</span>
          </div>

          <ol className="flex flex-col">
            {execution.steps.map((step, index) => {
              const progress = state?.steps.find((candidate) => candidate.stepId === step.id)
              const run = progress?.runId
                ? runs.find((candidate) => candidate.id === progress.runId)
                : undefined
              const readiness =
                run?.status === 'running'
                  ? health.find((candidate) => candidate.runId === run.id)
                  : undefined
              const project = projects.find((p) => p.id === step.projectId)

              return (
                <GroupStepCard
                  key={step.id}
                  step={step}
                  index={index}
                  totalSteps={execution.steps.length}
                  executionMode={execution.mode}
                  stepProgress={progress}
                  run={run}
                  readiness={readiness}
                  projectName={project?.name ?? '（已移除的项目）'}
                  now={now}
                  onOpenRun={onOpenRun}
                />
              )
            })}
          </ol>
        </div>
      </div>

      {/* Bottom task output terminal panel */}
      <GroupOutputPanel group={execution} state={state} projects={projects} runs={runs} />

      {editing && <GroupEditor group={group} onClose={() => setEditing(false)} />}
    </section>
  )
}
