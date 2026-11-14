import type { GroupStepState } from '@devhub/shared'
import { cn } from '@renderer/lib/utils'

interface GroupProgressBarProps {
  completedCount: number
  totalCount: number
  stepStates: GroupStepState[]
  durationText?: string | null
  statusHint?: string | null
}

export function GroupProgressBar({
  completedCount,
  totalCount,
  stepStates,
  durationText,
  statusHint
}: GroupProgressBarProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card/30 px-4 py-2.5 text-xs md:px-6">
      <span className="font-semibold text-foreground">
        {completedCount} / {totalCount} 步完成
      </span>

      {/* Segmented progress bar */}
      <div
        className="flex h-1.5 min-w-32 flex-1 items-center gap-1"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label="执行进度"
      >
        {Array.from({ length: totalCount }).map((_, i) => {
          const state = stepStates[i] ?? 'pending'
          const isDone = state === 'done'
          const isRunning = state === 'running'
          const isFailed = state === 'failed'

          return (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                isDone && 'bg-accent',
                isRunning && 'animate-pulse bg-accent shadow-[0_0_8px_rgba(62,213,152,0.6)]',
                isFailed && 'bg-destructive',
                !isDone && !isRunning && !isFailed && 'bg-secondary/70'
              )}
            />
          )
        })}
      </div>

      {durationText && <span className="font-mono text-muted-foreground">{durationText}</span>}

      {durationText && statusHint && <div className="h-3 w-px bg-border" aria-hidden="true" />}

      {statusHint && <span className="text-muted-foreground">{statusHint}</span>}
    </div>
  )
}
