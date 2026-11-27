import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  ChevronUp,
  CircleAlert,
  CircleDot,
  Radio,
  Smartphone,
  Wifi
} from 'lucide-react'
import type { Run } from '@devhub/shared'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useProjects } from '@renderer/features/projects/use-projects'
import { healthLabels, useRunHealth } from '@renderer/features/runs/use-run-health'
import { useRuns } from '@renderer/features/runs/use-runs'
import { useRemoteState } from '@renderer/features/settings/use-remote'
import { cn } from '@renderer/lib/utils'
import { narrowQuery, useMediaQuery } from '@renderer/lib/use-media-query'
import { buildStatusBarSummary, type StatusBarHealthItem } from './status-bar-summary'

interface StatusBarProps {
  onOpenRun?: (run: Run) => void
  onOpenRunningView?: () => void
}

const STATE_DOT_CLASS: Record<StatusBarHealthItem['state'], string> = {
  unhealthy: 'bg-destructive',
  starting: 'animate-pulse bg-warning',
  ready: 'bg-success'
}

const STATE_TEXT_CLASS: Record<StatusBarHealthItem['state'], string> = {
  unhealthy: 'text-destructive',
  starting: 'text-warning',
  ready: 'text-success'
}

function HealthPopoverRow({
  item,
  onSelect
}: {
  item: StatusBarHealthItem
  onSelect?: (run: Run) => void
}): React.JSX.Element {
  const canJump = Boolean(item.run && onSelect)
  const content = (
    <>
      <span className={cn('size-2 shrink-0 rounded-full', STATE_DOT_CLASS[item.state])} />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-foreground">
            {item.projectName} · {item.scriptTitle}
          </span>
          {item.pid !== null && (
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              PID {item.pid}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn('shrink-0 font-medium', STATE_TEXT_CLASS[item.state])}>
            {healthLabels[item.state]}
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-mono">{item.target}</span>
        </div>
      </div>
      {canJump && (
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      )}
    </>
  )

  if (canJump && item.run && onSelect) {
    const targetRun = item.run
    return (
      <button
        type="button"
        onClick={() => onSelect(targetRun)}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
        title={`跳转到 ${item.projectName} · ${item.scriptTitle} 终端`}
      >
        {content}
      </button>
    )
  }

  return <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5">{content}</div>
}

export function StatusBar({
  onOpenRun,
  onOpenRunningView
}: StatusBarProps = {}): React.JSX.Element {
  const { data: runs = [] } = useRuns()
  const { data: health = [] } = useRunHealth()
  const { data: projects = [] } = useProjects()
  const { data: remote } = useRemoteState()
  const narrow = useMediaQuery(narrowQuery)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = (): void => setOnline(true)
    const handleOffline = (): void => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const summary = buildStatusBarSummary({ runs, health, projects })
  const failedRun = summary.failedRun
  const hasUnhealthy = summary.counts.unhealthy > 0
  const hasStartingOnly = !hasUnhealthy && summary.counts.starting > 0 && summary.counts.ready === 0

  const handleOpenHealthRun = (run: Run): void => {
    setPopoverOpen(false)
    setMobileOpen(false)
    onOpenRun?.(run)
  }

  if (narrow) {
    const activeLabel = summary.activeCount > 0 ? `${summary.activeCount} 个运行中` : '空闲'
    return (
      <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="展开系统状态"
            aria-expanded={mobileOpen}
            className={cn(
              'app-no-drag fixed right-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex h-9 items-center gap-2 rounded-full border border-border bg-card/95 px-3 text-[11px] font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-card',
              hasUnhealthy && 'border-destructive/40 text-destructive'
            )}
          >
            <CircleDot
              className={cn(
                'size-3 shrink-0',
                hasUnhealthy
                  ? 'bg-destructive'
                  : summary.activeCount > 0
                    ? 'animate-pulse bg-success'
                    : 'bg-muted-foreground/60'
              )}
            />
            <span>{activeLabel}</span>
            {summary.healthItems.length > 0 && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {summary.counts.total}
              </span>
            )}
            <ChevronUp
              className={cn('size-3.5 shrink-0 transition-transform', mobileOpen && 'rotate-180')}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={8}
          aria-label="系统状态详情"
          className="w-[min(20rem,calc(100vw-1.5rem))] gap-0 p-0"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">系统状态</span>
            <span className="text-[11px] text-muted-foreground">{activeLabel}</span>
          </div>
          {summary.activeCount > 0 && onOpenRunningView && (
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false)
                onOpenRunningView()
              }}
              className="flex w-full items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              <CircleDot className="size-3 animate-pulse text-success" />
              查看运行中任务
            </button>
          )}
          {summary.healthItems.length > 0 && (
            <div className="max-h-72 overflow-y-auto p-1.5">
              {summary.healthItems.map((item) => (
                <HealthPopoverRow
                  key={item.runId}
                  item={item}
                  onSelect={onOpenRun ? handleOpenHealthRun : undefined}
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Smartphone
                className={cn(
                  'size-3 shrink-0',
                  remote?.enabled ? 'text-primary' : 'text-muted-foreground/60'
                )}
              />
              {remote?.enabled ? '远程访问已开启' : '远程未开启'}
            </span>
            <span className="flex items-center gap-1.5">
              <Wifi
                className={cn('size-3 shrink-0', online ? 'text-success' : 'text-destructive')}
              />
              {online ? '在线' : '离线'}
            </span>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <footer
      role="status"
      aria-label="系统状态"
      className="app-no-drag flex h-[26px] shrink-0 items-center gap-3 overflow-hidden whitespace-nowrap border-t border-border bg-card px-3 text-[11px] text-muted-foreground select-none"
    >
      {summary.activeCount > 0 && onOpenRunningView ? (
        <button
          type="button"
          onClick={onOpenRunningView}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium text-foreground transition-colors hover:text-primary"
          title="查看运行中任务"
        >
          <CircleDot className="size-3 shrink-0 animate-pulse text-success" />
          <span>{summary.activeCount} 个运行中</span>
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-medium">
          <CircleDot
            className={cn(
              'size-3 shrink-0',
              summary.activeCount > 0 ? 'animate-pulse text-success' : 'text-muted-foreground/60'
            )}
          />
          <span className={summary.activeCount > 0 ? 'text-foreground' : undefined}>
            {summary.activeCount > 0 ? `${summary.activeCount} 个运行中` : '空闲'}
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        {summary.healthItems.length > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="查看运行健康详情"
                className={cn(
                  'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-muted/70',
                  hasUnhealthy
                    ? 'font-medium text-destructive hover:text-destructive'
                    : 'hover:text-foreground'
                )}
              >
                {hasUnhealthy ? (
                  <CircleAlert className="size-3 shrink-0 text-destructive" />
                ) : (
                  <Radio
                    className={cn(
                      'size-3 shrink-0',
                      hasStartingOnly ? 'animate-pulse text-warning' : 'text-info'
                    )}
                  />
                )}
                <span className="truncate">{summary.triggerLabel}</span>
                <ChevronUp className="size-3 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={6}
              aria-label="运行健康详情列表"
              className="w-80 gap-0 p-0"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <span className="text-xs font-semibold text-foreground">运行健康状态</span>
                <span className="text-[11px] text-muted-foreground">
                  共 {summary.counts.total} 项
                  {summary.counts.unhealthy > 0 ? ` · ${summary.counts.unhealthy} 无响应` : ''}
                  {summary.counts.starting > 0 ? ` · ${summary.counts.starting} 启动中` : ''}
                </span>
              </div>
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1.5">
                {summary.healthItems.map((item) => (
                  <HealthPopoverRow
                    key={item.runId}
                    item={item}
                    onSelect={onOpenRun ? handleOpenHealthRun : undefined}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {failedRun &&
          (onOpenRun ? (
            <button
              type="button"
              onClick={() => onOpenRun(failedRun)}
              className="hidden md:inline-flex min-w-0 max-w-[200px] items-center gap-1.5 text-destructive transition-opacity hover:opacity-80"
              title={`${summary.failedProjectName} · ${failedRun.title} 上次失败（点击查看终端）`}
            >
              <CircleAlert className="size-3 shrink-0" />
              <span className="truncate">{failedRun.title} 上次失败</span>
            </button>
          ) : (
            <div className="hidden md:flex min-w-0 max-w-[200px] items-center gap-1.5 text-destructive">
              <CircleAlert className="size-3 shrink-0" />
              <span className="truncate">{failedRun.title} 上次失败</span>
            </div>
          ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Smartphone
          className={cn(
            'size-3 shrink-0',
            remote?.enabled ? 'text-primary' : 'text-muted-foreground/60'
          )}
        />
        <span className="hidden sm:inline">
          {remote?.enabled ? '远程访问已开启' : '远程未开启'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Wifi className={cn('size-3 shrink-0', online ? 'text-success' : 'text-destructive')} />
        <span>{online ? '在线' : '离线'}</span>
      </div>
    </footer>
  )
}
