import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  CodeXml,
  Copy,
  Info,
  Menu,
  Minus,
  Search,
  Settings as SettingsIcon,
  Square,
  Trash2,
  X
} from 'lucide-react'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { UpdateBadge } from '@renderer/features/updates/update-badge'
import {
  formatNotificationTime,
  notify,
  useNotifications,
  useUnreadNotificationsCount,
  type NotificationType
} from '@renderer/lib/notifications'
import { cn } from '@renderer/lib/utils'
import { useWindowState } from './use-window-state'

interface TitleBarProps {
  showSettings: boolean
  onToggleSettings: () => void
  /** Opens the search palette dialog. */
  onOpenSearch?: () => void
  /** Opens the sidebar drawer; only given on narrow screens, where the sidebar is hidden. */
  onOpenNavigation?: () => void
}

/**
 * Replaces the system title bar (ADR 0010): drags the window, and on Windows / Linux carries
 * the minimize / maximize / close buttons. macOS keeps its own traffic lights on the left.
 */
export function TitleBar({
  showSettings,
  onToggleSettings,
  onOpenSearch,
  onOpenNavigation
}: TitleBarProps): React.JSX.Element {
  const { data: appInfo } = useAppInfo()
  const windowState = useWindowState()
  const notifications = useNotifications()
  const unreadCount = useUnreadNotificationsCount()
  const isMac = windowState?.platform === 'darwin'
  // Traffic lights are hidden in full screen, so their space is only kept outside it.
  const trafficLightGap = isMac && !windowState.fullScreen

  return (
    <header
      className={cn(
        'app-drag flex h-[46px] shrink-0 items-center gap-2.5 border-b border-border bg-card px-3',
        trafficLightGap && 'pl-20',
        (isMac || !windowState) && 'pr-3'
      )}
    >
      {onOpenNavigation && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenNavigation}
          aria-label="打开导航"
          title="项目与批量任务"
          className="app-no-drag -ml-1"
        >
          <Menu />
        </Button>
      )}
      <div className="app-no-drag flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-primary text-primary-foreground shadow-xs">
          <CodeXml className="size-3.5 stroke-[2.5]" />
        </div>
        <h1 className="font-heading text-[13px] font-semibold tracking-tight text-foreground">
          DevHub
        </h1>
        {appInfo && (
          <span className="font-mono text-[10px] text-muted-foreground/80">v{appInfo.version}</span>
        )}
      </div>

      <div className="app-no-drag mx-auto flex items-center justify-center px-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-[30px] w-[300px] cursor-pointer items-center gap-2 rounded-[7px] border border-border bg-secondary/60 px-2.5 text-muted-foreground transition-colors hover:border-border-strong hover:bg-secondary/90 sm:flex"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="truncate text-[11px] select-none">搜索项目、脚本或运行记录</span>
          <kbd className="ml-auto rounded border border-border bg-background/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground select-none">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="app-no-drag ml-auto flex items-center gap-1">
        <UpdateBadge />

        {/* Notifications Popover */}
        <Popover onOpenChange={(open) => open && notify.markAllAsRead()}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="通知"
              title={unreadCount > 0 ? `通知 (${unreadCount} 条未读)` : '通知'}
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-card"
                  aria-hidden
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 border-border bg-card p-0 shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground">系统通知</span>
                {notifications.length > 0 && (
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {notifications.length}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => notify.clear()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                  title="清空所有通知"
                >
                  <Trash2 className="size-3" />
                  <span>清空</span>
                </button>
              )}
            </div>
            <div className="max-h-72 divide-y divide-border/50 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
                  <BellOff className="size-6 stroke-[1.5] text-muted-foreground/60" />
                  <p className="text-xs">暂无新通知</p>
                  <span className="text-[10px] text-muted-foreground/60">
                    运行错误与系统消息将在此汇总
                  </span>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2.5 p-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <NotificationTypeIcon type={item.type} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-medium text-foreground">
                          {item.title ?? (item.type === 'error' ? '操作失败' : '通知')}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                          {formatNotificationTime(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground break-all">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* GitHub link */}
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href="https://github.com/Delta1035/devhub"
            target="_blank"
            rel="noreferrer"
            aria-label="DevHub GitHub 仓库"
            title="DevHub GitHub 仓库"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-4">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8" />
            </svg>
          </a>
        </Button>

        {/* Settings button */}
        <Button
          variant={showSettings ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={onToggleSettings}
          aria-label="设置"
          aria-pressed={showSettings}
          title="设置"
        >
          <SettingsIcon />
        </Button>
      </div>

      {windowState && !isMac && <WindowButtons maximized={windowState.maximized} />}
    </header>
  )
}

function WindowButtons({ maximized }: { maximized: boolean }): React.JSX.Element {
  const button =
    'app-no-drag flex h-[46px] w-[46px] items-center justify-center text-foreground/80 transition-colors'
  return (
    <div className="ml-2 -my-2 flex self-stretch">
      <button
        type="button"
        className={cn(button, 'hover:bg-accent')}
        onClick={() => void shell?.minimizeWindow()}
        aria-label="最小化"
        title="最小化"
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        className={cn(button, 'hover:bg-accent')}
        onClick={() => void shell?.toggleMaximizeWindow()}
        aria-label={maximized ? '还原' : '最大化'}
        title={maximized ? '还原' : '最大化'}
      >
        {maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />}
      </button>
      <button
        type="button"
        className={cn(button, 'hover:bg-red-600 hover:text-white')}
        onClick={() => void shell?.closeWindow()}
        aria-label="关闭"
        title="关闭"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

function NotificationTypeIcon({ type }: { type: NotificationType }): React.JSX.Element {
  switch (type) {
    case 'error':
      return <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
    case 'warning':
      return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
    case 'success':
      return <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
    case 'info':
    default:
      return <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
  }
}
