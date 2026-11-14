import { useEffect, useState } from 'react'
import { Loader2, Square, X } from 'lucide-react'
import type { Project, Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  describeActiveGroup,
  type ActiveGroupView
} from '@renderer/features/groups/use-active-groups'
import { useStopGroup } from '@renderer/features/groups/use-groups'
import { useStopRun } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'

interface SidebarRunningSectionProps {
  activeRuns: Run[]
  activeGroups: ActiveGroupView[]
  projects: Project[]
  onSelectGroup: (groupId: string) => void
  onOpenRun: (run: Run) => void
}

function formatElapsed(startedAt: string, now: number): string {
  const start = new Date(startedAt).getTime()
  if (isNaN(start)) return '0s'
  const elapsed = Math.max(0, Math.floor((now - start) / 1000))
  if (elapsed < 60) return `${elapsed}s`
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
  return now
}

export function SidebarRunningSection({
  activeRuns,
  activeGroups,
  projects,
  onSelectGroup,
  onOpenRun
}: SidebarRunningSectionProps): React.JSX.Element | null {
  const stopRun = useStopRun()
  const stopGroup = useStopGroup()
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useNow(activeRuns.length > 0)

  const hasRunning = activeRuns.length > 0 || activeGroups.length > 0
  if (!hasRunning) return null

  const projectMap = new Map(projects.map((p) => [p.id, p.name]))
  const totalCount = activeRuns.length + activeGroups.length

  return (
    <section
      className="flex shrink-0 flex-col gap-1.5 border-t border-border/60 pt-2"
      aria-label="运行中任务"
    >
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">
            运行中
          </span>
          <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
            {totalCount}
          </span>
        </div>
      </header>

      {actionError && (
        <p className="flex items-start gap-1 px-1.5 text-xs text-destructive">
          <span className="min-w-0 flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="关闭">
            <X className="size-3" />
          </button>
        </p>
      )}

      {/* Batch Groups: preserves role="region" and aria-label for E2E */}
      {activeGroups.length > 0 && (
        <section role="region" aria-label="正在运行的批量任务" className="flex flex-col gap-1">
          <ul className="flex flex-col gap-1">
            {activeGroups.map((group) => {
              const stopping = stopGroup.isPending && stopGroup.variables === group.groupId
              return (
                <li
                  key={group.groupId}
                  className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/50 bg-card/60 px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    onClick={() => onSelectGroup(group.groupId)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-label={`查看运行中的批量任务 ${group.name}`}
                    title={`查看 ${group.name}`}
                  >
                    {group.phase === 'starting' ? (
                      <Loader2 className="size-3 shrink-0 animate-spin text-info" />
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-success" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-foreground">
                        {group.name}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {describeActiveGroup(group)}
                      </div>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={stopping}
                    onClick={() =>
                      stopGroup.mutate(group.groupId, {
                        onError: (e) => setActionError(e.message)
                      })
                    }
                    aria-label={`停止运行中的批量任务 ${group.name}`}
                    title="停止全部"
                  >
                    {stopping ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Square className="size-3 text-muted-foreground transition-colors group-hover:text-destructive" />
                    )}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {activeRuns.map((run) => {
            const projectName = projectMap.get(run.projectId) ?? '未知项目'
            const stopping =
              run.status === 'stopping' || (stopRun.isPending && stopRun.variables === run.id)
            return (
              <li
                key={run.id}
                className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/50 bg-card/60 px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => onOpenRun(run)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-label={`查看运行中的 ${projectName} · ${run.title}`}
                  title={`点击查看 ${projectName} · ${run.title}`}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      stopping ? 'animate-pulse bg-warning' : 'bg-success'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">
                      {projectName} <span className="text-muted-foreground">·</span> {run.title}
                    </div>
                    <div className="truncate font-mono text-[10px] text-muted-foreground">
                      {formatElapsed(run.startedAt, now)}
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={stopping}
                  onClick={() =>
                    stopRun.mutate(run.id, {
                      onError: (e) => setActionError(e.message)
                    })
                  }
                  aria-label={`停止运行中的 ${projectName} · ${run.title}`}
                  title="停止运行"
                >
                  {stopping ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Square className="size-3 text-muted-foreground transition-colors group-hover:text-destructive" />
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
