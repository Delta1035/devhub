import { useEffect, useState } from 'react'
import { CircleAlert, CircleDot, Radio, Smartphone, Wifi } from 'lucide-react'
import { useRunHealth } from '@renderer/features/runs/use-run-health'
import { useRuns } from '@renderer/features/runs/use-runs'
import { useRemoteState } from '@renderer/features/settings/use-remote'
import { cn } from '@renderer/lib/utils'

export function StatusBar(): React.JSX.Element {
  const { data: runs = [] } = useRuns()
  const { data: health = [] } = useRunHealth()
  const { data: remote } = useRemoteState()
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

  const activeRuns = runs.filter((r) => r.status !== 'exited')
  const failedRun = runs.find((r) => r.status === 'exited' && !r.stopped && r.exitCode !== 0)
  const readyHealth = health.filter((h) => h.state === 'ready')

  return (
    <footer
      role="status"
      aria-label="系统状态"
      className="app-no-drag flex h-[26px] shrink-0 items-center gap-3 border-t border-border bg-card px-3 text-[11px] text-muted-foreground select-none"
    >
      <div className="flex items-center gap-1.5 font-medium">
        <CircleDot
          className={cn(
            'size-3',
            activeRuns.length > 0 ? 'animate-pulse text-success' : 'text-muted-foreground/60'
          )}
        />
        <span className={activeRuns.length > 0 ? 'text-foreground' : undefined}>
          {activeRuns.length > 0 ? `${activeRuns.length} 个运行中` : '空闲'}
        </span>
      </div>

      {readyHealth.length > 0 && (
        <div className="hidden sm:flex items-center gap-1.5">
          <Radio className="size-3 text-info" />
          <span>
            端口 {readyHealth.map((h) => h.target.replace(/^.*:/, '')).join(' · ')} 已就绪
          </span>
        </div>
      )}

      {failedRun && (
        <div className="hidden md:flex items-center gap-1.5 text-destructive">
          <CircleAlert className="size-3" />
          <span className="max-w-[200px] truncate">{failedRun.title} 上次失败</span>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Smartphone
          className={cn('size-3', remote?.enabled ? 'text-primary' : 'text-muted-foreground/60')}
        />
        <span className="hidden sm:inline">
          {remote?.enabled ? '远程访问已开启' : '远程未开启'}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Wifi className={cn('size-3', online ? 'text-success' : 'text-destructive')} />
        <span>{online ? '在线' : '离线'}</span>
      </div>
    </footer>
  )
}
