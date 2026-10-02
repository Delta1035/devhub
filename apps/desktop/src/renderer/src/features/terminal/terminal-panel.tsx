import { SquareTerminal, X } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { useRemoveRun, useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import { RunTerminal } from './run-terminal'
import { useResizableHeight } from './use-resizable-height'

interface TerminalPanelProps {
  projectId: string
  /** Tab to show; falls back to the most recently started run. */
  activeRunId: string | null
  onActiveRunChange: (runId: string) => void
}

export function TerminalPanel({
  projectId,
  activeRunId,
  onActiveRunChange
}: TerminalPanelProps): React.JSX.Element {
  const { height, startResize } = useResizableHeight('devhub.terminalHeight', 260, 120)
  const removeRun = useRemoveRun()
  const runs = (useRuns().data ?? [])
    .filter((run) => run.projectId === projectId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const active = runs.find((run) => run.id === activeRunId) ?? runs.at(-1)

  return (
    <section className="flex shrink-0 flex-col border-t bg-muted/30" style={{ height }}>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖动调整终端高度"
        onPointerDown={startResize}
        className="h-1 shrink-0 cursor-row-resize touch-none hover:bg-ring/40"
      />
      <header className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-1">
        <SquareTerminal className="mr-1 size-4 shrink-0 text-muted-foreground" />
        {runs.length === 0 && <span className="text-sm font-medium">终端</span>}
        {runs.map((run) => (
          <RunTab
            key={run.id}
            run={run}
            selected={run.id === active?.id}
            onSelect={() => onActiveRunChange(run.id)}
            onClose={() => removeRun.mutate(run.id)}
          />
        ))}
      </header>
      <div className="min-h-0 flex-1 p-2">
        {active ? (
          <RunTerminal
            key={active.id}
            runId={active.id}
            acceptsInput={active.status !== 'exited'}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            运行脚本后在这里查看输出
          </p>
        )}
      </div>
    </section>
  )
}

interface RunTabProps {
  run: Run
  selected: boolean
  onSelect: () => void
  onClose: () => void
}

function RunTab({ run, selected, onSelect, onClose }: RunTabProps): React.JSX.Element {
  const exited = run.status === 'exited'
  const failed = exited && !run.stopped && run.exitCode !== 0

  return (
    <div
      className={cn(
        'flex shrink-0 items-center rounded-md text-sm hover:bg-muted',
        selected && 'bg-background shadow-xs'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          exited && 'text-muted-foreground'
        )}
      >
        <span
          className={cn(
            'size-2 rounded-full',
            run.status === 'running' && 'bg-emerald-500',
            run.status === 'stopping' && 'animate-pulse bg-amber-500',
            exited && (failed ? 'bg-destructive' : 'bg-muted-foreground/40')
          )}
        />
        {run.scriptName}
      </button>
      {exited && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          title="关闭"
          aria-label={`关闭 ${run.scriptName} 的终端`}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
