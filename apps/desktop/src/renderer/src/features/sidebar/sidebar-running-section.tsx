import { useEffect, useState } from 'react'
import { Layers3, Link2, Loader2, RotateCcw, Square, X } from 'lucide-react'
import type { Run, RunHealth } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { describeActiveGroup } from '@renderer/features/groups/use-active-groups'
import { useStartGroup, useStopGroup } from '@renderer/features/groups/use-groups'
import type {
  RunningChildItem,
  RunningHierarchy,
  RunningStandaloneItem
} from '@renderer/features/runs/running-hierarchy'
import { healthLabels } from '@renderer/features/runs/use-run-health'
import { useStopRun } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'

interface SidebarRunningSectionProps {
  variant?: 'sidebar' | 'page'
  hierarchy: RunningHierarchy
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

function RunRow({
  run,
  projectName,
  health,
  stepNumbers,
  reused,
  sharedWithGroupNames,
  treeBranch = false,
  page,
  now,
  stopping,
  onOpenRun,
  onStopRun
}: {
  run: Run
  projectName: string
  health: RunHealth | undefined
  stepNumbers?: number[]
  reused?: boolean
  sharedWithGroupNames?: string[]
  treeBranch?: boolean
  page: boolean
  now: number
  stopping: boolean
  onOpenRun: (run: Run) => void
  onStopRun: (runId: string) => void
}): React.JSX.Element {
  const dotClass = stopping
    ? 'animate-pulse bg-warning'
    : health?.state === 'unhealthy'
      ? 'bg-destructive'
      : health?.state === 'starting'
        ? 'animate-pulse bg-warning'
        : 'bg-success'

  return (
    <li
      className={cn(
        'group relative flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/70 transition-colors hover:bg-muted/50',
        page ? 'px-3 py-2' : 'px-2 py-1.5',
        treeBranch &&
          'before:absolute before:top-1/2 before:-left-3.5 before:h-px before:w-3 before:bg-primary/35'
      )}
    >
      <button
        type="button"
        onClick={() => onOpenRun(run)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`查看运行中的 ${projectName} · ${run.title}`}
        title={`点击查看 ${projectName} · ${run.title}`}
      >
        <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">
              {projectName} <span className="text-muted-foreground">·</span> {run.title}
            </span>
            {stepNumbers && stepNumbers.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 border-0 bg-secondary/80 px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
              >
                步骤 {stepNumbers.join('、')}
              </Badge>
            )}
            {reused && (
              <Badge
                variant="secondary"
                className="h-4 border-0 bg-info/15 px-1.5 text-[10px] font-normal text-info"
              >
                复用
              </Badge>
            )}
            {health && (
              <Badge
                variant="secondary"
                className={cn(
                  'h-4 border-0 px-1.5 text-[10px] font-normal',
                  health.state === 'ready' && 'bg-success/15 text-success',
                  health.state === 'starting' && 'bg-warning/15 text-warning',
                  health.state === 'unhealthy' && 'bg-destructive/15 text-destructive'
                )}
              >
                {healthLabels[health.state]}
              </Badge>
            )}
            {sharedWithGroupNames && sharedWithGroupNames.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 gap-1 border-0 bg-info/15 px-1.5 text-[10px] font-normal text-info"
                title={`同时关联于：${sharedWithGroupNames.join('、')}`}
              >
                <Link2 className="size-2.5 shrink-0" />
                关联：{sharedWithGroupNames.join('、')}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
            {formatElapsed(run.startedAt, now)}
          </div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={stopping}
        onClick={() => onStopRun(run.id)}
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
}

export function SidebarRunningSection({
  variant = 'sidebar',
  hierarchy,
  onSelectGroup,
  onOpenRun
}: SidebarRunningSectionProps): React.JSX.Element | null {
  const stopRun = useStopRun()
  const startGroup = useStartGroup()
  const stopGroup = useStopGroup()
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useNow(hierarchy.activeRunCount > 0)

  if (!hierarchy.hasActive) return null

  const page = variant === 'page'

  const handleStopRun = (runId: string): void => {
    stopRun.mutate(runId, {
      onError: (e) => setActionError(e.message)
    })
  }

  const isStoppingRun = (run: Run): boolean =>
    run.status === 'stopping' || (stopRun.isPending && stopRun.variables === run.id)

  return (
    <section
      className={cn(
        'flex flex-col',
        page ? 'gap-4' : 'shrink-0 gap-1.5 border-t border-border/60 pt-2'
      )}
      aria-label="运行中任务"
    >
      {!page && (
        <header className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground">
              运行中
            </span>
            <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-success">
              {hierarchy.activeRunCount}
            </span>
          </div>
        </header>
      )}

      {actionError && (
        <p className="flex items-start gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <span className="min-w-0 flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="关闭">
            <X className="size-3" />
          </button>
        </p>
      )}

      {/* Batch Groups with nested child runs: preserves role="region" and aria-label for E2E */}
      {hierarchy.groupNodes.length > 0 && (
        <section role="region" aria-label="正在运行的批量任务" className="flex flex-col gap-2">
          {page && (
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
                批量任务
              </h2>
              <span className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {hierarchy.groupNodes.length}
              </span>
            </div>
          )}
          <ul className="flex flex-col gap-3">
            {hierarchy.groupNodes.map((node) => {
              const { group, mode, children, waitingMessage } = node
              const starting = startGroup.isPending && startGroup.variables === group.groupId
              const stopping = stopGroup.isPending && stopGroup.variables === group.groupId
              return (
                <li
                  key={group.groupId}
                  aria-label={`批量任务 ${group.name}`}
                  className="overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-2xs"
                >
                  <div
                    className={cn(
                      'group flex items-center justify-between gap-2 bg-card/80',
                      page ? 'px-3.5 py-2.5' : 'px-2.5 py-2'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectGroup(group.groupId)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`查看运行中的批量任务 ${group.name}`}
                      title={`查看 ${group.name}`}
                    >
                      {group.phase === 'starting' ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-info" />
                      ) : (
                        <span className="size-2 shrink-0 rounded-full bg-success" />
                      )}
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Layers3 className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-foreground">
                          {group.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 truncate font-mono text-[10px] text-muted-foreground">
                          <span>{describeActiveGroup(group)}</span>
                          {mode && (
                            <span className="rounded bg-secondary/80 px-1 py-0.25 text-[9px] text-muted-foreground">
                              {mode === 'parallel' ? '并行' : '串行'}
                            </span>
                          )}
                          {waitingMessage && (
                            <span className="truncate font-sans text-info">· {waitingMessage}</span>
                          )}
                        </div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={starting || stopping || group.phase === 'starting'}
                        onClick={() =>
                          startGroup.mutate(group.groupId, {
                            onError: (e) => setActionError(e.message)
                          })
                        }
                        aria-label={`重新执行批量任务 ${group.name}`}
                        title="重新执行（复用仍在运行的脚本）"
                      >
                        {starting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={stopping || starting}
                        onClick={() =>
                          stopGroup.mutate(group.groupId, {
                            onError: (e) => setActionError(e.message)
                          })
                        }
                        aria-label={`停止运行中的批量任务 ${group.name}`}
                        title="停止全部"
                      >
                        {stopping ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Square className="size-3.5 text-muted-foreground transition-colors group-hover:text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Nested child runs */}
                  <div className="border-t border-border/60 bg-background/40 px-3.5 py-2.5">
                    {children.length > 0 ? (
                      <ul
                        aria-label={`${group.name} 的子任务`}
                        className="ml-2 flex flex-col gap-1.5 border-l-2 border-primary/35 pl-3.5"
                      >
                        {children.map((child: RunningChildItem) => (
                          <RunRow
                            key={child.run.id}
                            run={child.run}
                            projectName={child.projectName}
                            health={child.health}
                            stepNumbers={child.stepNumbers}
                            reused={child.reused}
                            sharedWithGroupNames={child.sharedWithGroupNames}
                            treeBranch={true}
                            page={page}
                            now={now}
                            stopping={isStoppingRun(child.run)}
                            onOpenRun={onOpenRun}
                            onStopRun={handleStopRun}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="pl-2 text-[11px] text-muted-foreground">
                        {waitingMessage ?? '正在准备启动子任务…'}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Standalone Active Runs */}
      {hierarchy.standaloneRuns.length > 0 && (
        <section role="region" aria-label="独立运行" className="flex flex-col gap-2">
          {page && (
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground">
                独立运行
              </h2>
              <span className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {hierarchy.standaloneRuns.length}
              </span>
            </div>
          )}
          <ul className={cn('flex flex-col gap-1.5 overflow-y-auto', !page && 'max-h-48')}>
            {hierarchy.standaloneRuns.map((item: RunningStandaloneItem) => (
              <RunRow
                key={item.run.id}
                run={item.run}
                projectName={item.projectName}
                health={item.health}
                page={page}
                now={now}
                stopping={isStoppingRun(item.run)}
                onOpenRun={onOpenRun}
                onStopRun={handleStopRun}
              />
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
