import { lazy, Suspense, useState } from 'react'
import { Maximize2, Minimize2, SquareTerminal, X } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { healthLabels, useHealthOf } from '@renderer/features/runs/use-run-health'
import { useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import { NewTerminalButton } from './new-terminal-button'
import { useResizableHeight } from './use-resizable-height'
import { useCloseRun } from './use-shells'

// xterm is a third of the app's code; a project without runs (and the web app's first paint)
// does without it.
const RunTerminal = lazy(() =>
  import('./run-terminal').then(({ RunTerminal }) => ({ default: RunTerminal }))
)

interface TerminalPanelProps {
  projectId: string
  /** Tab to show; falls back to the most recently started run. */
  activeRunId: string | null
  onActiveRunChange: (runId: string) => void
  /** Fills the whole detail area, hiding the script list. */
  maximized: boolean
  onToggleMaximized: () => void
}

export function TerminalPanel({
  projectId,
  activeRunId,
  onActiveRunChange,
  maximized,
  onToggleMaximized
}: TerminalPanelProps): React.JSX.Element {
  const { height, startResize } = useResizableHeight('devhub.terminalHeight', 260, 120)
  const closeRun = useCloseRun()
  const [error, setError] = useState<Error | null>(null)
  const runs = (useRuns().data ?? [])
    .filter((run) => run.projectId === projectId)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const active = runs.find((run) => run.id === activeRunId) ?? runs.at(-1)

  return (
    <section
      className={cn(
        'flex flex-col border-t bg-muted/30',
        maximized ? 'min-h-0 flex-1' : 'shrink-0'
      )}
      style={maximized ? undefined : { height }}
    >
      {!maximized && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="拖动调整终端高度"
          onPointerDown={startResize}
          className="h-1 shrink-0 cursor-row-resize touch-none hover:bg-ring/40"
        />
      )}
      <header
        className="flex shrink-0 items-center gap-1 border-b px-3 py-1"
        // Double-clicking empty space in the tab bar toggles maximize, as in VS Code.
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) onToggleMaximized()
        }}
      >
        <SquareTerminal className="mr-1 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {runs.length === 0 && <span className="text-sm font-medium">终端</span>}
          {runs.map((run) => (
            <RunTab
              key={run.id}
              run={run}
              selected={run.id === active?.id}
              closing={closeRun.isPending && closeRun.variables?.id === run.id}
              onSelect={() => onActiveRunChange(run.id)}
              onClose={() => closeRun.mutate(run, { onError: setError })}
            />
          ))}
        </div>
        {access.terminal && (
          <NewTerminalButton
            projectId={projectId}
            onStarted={(run) => onActiveRunChange(run.id)}
            onError={setError}
          />
        )}
        <div className="flex-1" />
        {error && (
          <p className="flex min-w-0 items-center gap-1 text-xs text-destructive">
            <span className="truncate" title={error.message}>
              {error.message}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={() => setError(null)} aria-label="关闭">
              <X />
            </Button>
          </p>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onToggleMaximized}
          title={maximized ? '还原终端面板' : '最大化终端面板'}
          aria-label={maximized ? '还原终端面板' : '最大化终端面板'}
        >
          {maximized ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </header>
      <div className="min-h-0 flex-1 p-2">
        {active ? (
          <Suspense>
            <RunTerminal
              key={active.id}
              runId={active.id}
              acceptsInput={active.status !== 'exited'}
            />
          </Suspense>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            运行脚本，或点击「+」新建终端
          </p>
        )}
      </div>
    </section>
  )
}

interface RunTabProps {
  run: Run
  selected: boolean
  closing: boolean
  onSelect: () => void
  onClose: () => void
}

function RunTab({ run, selected, closing, onSelect, onClose }: RunTabProps): React.JSX.Element {
  const exited = run.status === 'exited'
  const failed = exited && !run.stopped && run.exitCode !== 0
  // A shell can be closed any time (that ends it); a script only once it has exited, so a
  // running server is never stopped by a stray click on a tab.
  const closable = exited || run.kind === 'shell'
  const health = useHealthOf(run.status === 'running' ? run.id : undefined)

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
          title={health ? `${healthLabels[health.state]}（${health.target}）` : undefined}
          className={cn(
            'size-2 rounded-full',
            run.status === 'running' && 'bg-success',
            health?.state === 'starting' && 'bg-warning',
            health?.state === 'unhealthy' && 'bg-destructive',
            run.status === 'stopping' && 'animate-pulse bg-warning',
            exited && (failed ? 'bg-destructive' : 'bg-muted-foreground/40')
          )}
        />
        {run.title}
      </button>
      {closable && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          disabled={closing}
          title={exited ? '关闭' : '关闭（结束该终端及其中运行的命令）'}
          aria-label={`关闭 ${run.title}`}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
