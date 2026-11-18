import { CheckCircle2, ChevronDown, Trash2, XCircle } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useRemoveRun } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'

interface ExitedTerminalDropdownProps {
  exitedRuns: Run[]
  onSelectRun: (runId: string) => void
}

export function ExitedTerminalDropdown({
  exitedRuns,
  onSelectRun
}: ExitedTerminalDropdownProps): React.JSX.Element | null {
  const removeRun = useRemoveRun()

  if (exitedRuns.length === 0) return null

  const handleClearAll = (): void => {
    for (const run of exitedRuns) {
      removeRun.mutate(run.id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 font-mono text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          title="点击查看已结束或退出的终端"
        >
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          <span>已结束 ({exitedRuns.length})</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          已关闭或退出的终端
        </div>
        <DropdownMenuSeparator />
        {exitedRuns.map((run) => {
          const failed = !run.stopped && run.exitCode !== 0
          return (
            <DropdownMenuItem
              key={run.id}
              onSelect={() => onSelectRun(run.id)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {failed ? (
                  <XCircle className="size-3.5 shrink-0 text-destructive" />
                ) : (
                  <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-xs font-medium">{run.title}</span>
              </div>
              <span
                className={cn(
                  'shrink-0 font-mono text-[10px]',
                  failed ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {run.stopped
                  ? '已停止'
                  : run.exitCode !== null
                    ? `退出码 ${run.exitCode}`
                    : '已退出'}
              </span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleClearAll}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-3.5" />
          <span>清空已结束终端</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
