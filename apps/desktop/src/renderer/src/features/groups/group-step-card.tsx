import { Check, ChevronRight, Loader2, X as XIcon } from 'lucide-react'
import {
  describeCondition,
  formatDuration,
  getConditionBadge,
  stepStateLabels,
  type Group,
  type GroupStep,
  type GroupStepState,
  type Run,
  type RunHealth
} from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { healthLabels } from '@renderer/features/runs/use-run-health'
import { cn } from '@renderer/lib/utils'

interface GroupStepCardProps {
  step: GroupStep
  index: number
  totalSteps: number
  executionMode: Group['mode']
  stepProgress:
    | {
        stepId: string
        state: GroupStepState
        runId?: string
        reused?: boolean
        message?: string
      }
    | undefined
  run: Run | undefined
  readiness: RunHealth | undefined
  projectName: string
  now: number
  onOpenRun: (run: Run) => void
}

export function GroupStepCard({
  step,
  index,
  totalSteps,
  executionMode,
  stepProgress,
  run,
  readiness,
  projectName,
  now,
  onOpenRun
}: GroupStepCardProps): React.JSX.Element {
  const isSerial = executionMode === 'serial'
  const state = stepProgress?.state ?? 'pending'
  const isLast = index === totalSteps - 1

  // Duration
  let durationMs: number | null = null
  if (run?.startedAt) {
    const started = Date.parse(run.startedAt)
    const ended = run.endedAt ? Date.parse(run.endedAt) : now
    if (!Number.isNaN(started)) {
      durationMs = Math.max(0, ended - started)
    }
  }

  // Process label strictly keeping E2E text contracts
  const processLabel = run
    ? run.status === 'exited'
      ? `已退出（退出码 ${run.exitCode ?? '未知'}）`
      : run.status === 'stopping'
        ? '停止中'
        : readiness
          ? healthLabels[readiness.state]
          : '运行中'
    : stepProgress?.runId
      ? '运行已不可用'
      : '尚未启动'

  const statusBadgeLabel =
    state === 'done' && executionMode === 'parallel'
      ? '已启动'
      : state === 'running' && stepProgress?.message
        ? '等待条件'
        : stepStateLabels[state]

  const scriptDisplay = run?.title ?? step.scriptId.slice(step.scriptId.indexOf(':') + 1)
  const conditionBadge = getConditionBadge(step.continueWhen)

  return (
    <li aria-label={`运行步骤 ${index + 1}`} className="flex items-stretch gap-3 md:gap-4">
      {/* Left timeline connector and circular step number */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all',
            state === 'done' && 'bg-accent text-[#06130D]',
            state === 'running' &&
              'bg-accent text-[#06130D] shadow-[0_0_8px_rgba(62,213,152,0.6)] animate-pulse',
            state === 'failed' && 'bg-destructive text-destructive-foreground',
            state === 'cancelled' && 'bg-secondary text-muted-foreground',
            state === 'pending' && 'border border-border/80 bg-secondary/80 text-muted-foreground'
          )}
        >
          {state === 'done' ? (
            <Check className="size-3 stroke-[3]" />
          ) : state === 'failed' ? (
            <XIcon className="size-3 stroke-[3]" />
          ) : state === 'running' ? (
            <Loader2 className="size-3 animate-spin stroke-[3]" />
          ) : (
            index + 1
          )}
        </div>
        {!isLast && <div className="my-1 w-px flex-1 bg-border/60" aria-hidden="true" />}
      </div>

      {/* Right step card container */}
      <div
        className={cn(
          'mb-2 flex min-w-0 flex-1 flex-col gap-2 rounded-lg border p-3.5 transition-colors',
          state === 'running' && 'border-accent/40 bg-[#0F1519] shadow-sm',
          state === 'failed' && 'border-destructive/40 bg-[#1A1214]',
          state === 'done' && 'border-border/80 bg-[#0E1217]',
          state === 'pending' && 'border-border/50 bg-[#0D1116]/80'
        )}
      >
        {/* Main top row: project badge, script name, duration, status badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {projectName}
          </span>
          <span className="text-sm font-semibold text-foreground">{scriptDisplay}</span>
          {/* Kept for E2E text discovery */}
          <span className="sr-only">
            {index + 1}. {projectName} · {scriptDisplay}
          </span>

          <div className="flex-1" />

          {durationMs !== null && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatDuration(durationMs)}
            </span>
          )}

          <Badge
            variant={
              state === 'failed'
                ? 'destructive'
                : state === 'done' || state === 'running'
                  ? 'default'
                  : 'secondary'
            }
            className={cn(
              'h-5 px-2 text-[10px]',
              (state === 'done' || state === 'running') &&
                'border-transparent bg-accent/15 text-accent hover:bg-accent/20'
            )}
          >
            {statusBadgeLabel}
          </Badge>
        </div>

        {/* Condition row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground">
            {isSerial ? '等待' : '执行模式'}
          </span>
          {isSerial ? (
            <div className="flex items-center gap-1.5 rounded border border-border/80 bg-[#12171E] px-2 py-0.5 font-mono text-[11px] text-info">
              <span>{conditionBadge.text}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">并行启动，无等待条件</span>
          )}

          {/* Kept for E2E string matching */}
          <span className="sr-only">
            {isSerial
              ? `继续条件：${describeCondition(step.continueWhen)}`
              : '并行启动，无等待条件'}
          </span>

          {isSerial && conditionBadge.timeoutText && (
            <span className="text-[11px] text-muted-foreground font-mono">
              {conditionBadge.timeoutText}
            </span>
          )}
        </div>

        {/* Status message or latest output row */}
        {stepProgress?.message ? (
          <p
            className={cn(
              'flex items-center gap-1.5 break-words rounded bg-background/50 px-2 py-1 text-xs',
              state === 'failed'
                ? 'text-destructive font-medium'
                : 'text-muted-foreground font-mono'
            )}
          >
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{stepProgress.message}</span>
          </p>
        ) : null}

        {/* Card footer: process info, reuse label, view log button */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <span title={readiness?.target} className="text-muted-foreground">
            进程：{processLabel}
          </span>
          {stepProgress?.runId && (
            <span className="text-muted-foreground">
              {stepProgress.reused === undefined
                ? '启动来源未记录'
                : stepProgress.reused
                  ? '复用已有运行'
                  : '本次启动'}
            </span>
          )}

          {run ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-6 gap-1 px-2 text-xs hover:bg-secondary hover:text-foreground"
              onClick={() => onOpenRun(run)}
            >
              查看日志
            </Button>
          ) : stepProgress?.runId ? (
            <span className="ml-auto text-muted-foreground">日志不可用</span>
          ) : null}
        </div>
      </div>
    </li>
  )
}
