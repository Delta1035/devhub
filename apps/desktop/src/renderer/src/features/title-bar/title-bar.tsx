import { Copy, Layers, Menu, Minus, Settings as SettingsIcon, Square, X } from 'lucide-react'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import {
  describeActiveGroup,
  describeActiveGroups,
  useActiveGroups
} from '@renderer/features/groups/use-active-groups'
import { UpdateBadge } from '@renderer/features/updates/update-badge'
import { cn } from '@renderer/lib/utils'
import { useWindowState } from './use-window-state'

interface TitleBarProps {
  showSettings: boolean
  onToggleSettings: () => void
  /** Opens the sidebar drawer; only given on narrow screens, where the sidebar is hidden. */
  onOpenNavigation?: () => void
  /** Shows a batch run named in the title bar. */
  onSelectGroup: (groupId: string) => void
}

/**
 * Replaces the system title bar (ADR 0010): drags the window, and on Windows / Linux carries
 * the minimize / maximize / close buttons. macOS keeps its own traffic lights on the left.
 */
export function TitleBar({
  showSettings,
  onToggleSettings,
  onOpenNavigation,
  onSelectGroup
}: TitleBarProps): React.JSX.Element {
  const { data: appInfo } = useAppInfo()
  const windowState = useWindowState()
  const isMac = windowState?.platform === 'darwin'
  // Traffic lights are hidden in full screen, so their space is only kept outside it.
  const trafficLightGap = isMac && !windowState.fullScreen

  return (
    <header
      className={cn(
        'app-drag flex h-10 shrink-0 items-center gap-2 border-b pl-3',
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
      <img src="./favicon.svg" alt="" className="size-5" draggable={false} />
      <h1 className="font-heading text-sm font-semibold">DevHub</h1>
      {appInfo && <span className="text-xs text-muted-foreground">v{appInfo.version}</span>}
      {/* Phones show the drawer's list instead; there is no room here. */}
      {!onOpenNavigation && <ActiveGroupsIndicator onSelectGroup={onSelectGroup} />}
      <div className="app-no-drag ml-auto flex items-center gap-1">
        <UpdateBadge />
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

/** "前后端联调 · 运行中 2/3", or "前后端联调 等 2 个" with the full list on hover. */
function ActiveGroupsIndicator({
  onSelectGroup
}: {
  onSelectGroup: (groupId: string) => void
}): React.JSX.Element | null {
  const groups = useActiveGroups()
  const [first] = groups
  if (!first) return null
  const summary = `正在运行：${describeActiveGroups(groups)}`
  return (
    <button
      type="button"
      onClick={() => onSelectGroup(first.groupId)}
      title={summary}
      aria-label={summary}
      className="app-no-drag ml-2 flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent"
    >
      <Layers
        className={cn(
          'size-3.5 shrink-0',
          groups.some((group) => group.phase === 'starting')
            ? 'animate-pulse text-info'
            : 'text-success'
        )}
      />
      <span className="truncate font-medium">{first.name}</span>
      <span className="shrink-0 text-muted-foreground tabular-nums">
        {groups.length > 1 ? `等 ${groups.length} 个` : describeActiveGroup(first)}
      </span>
    </button>
  )
}

function WindowButtons({ maximized }: { maximized: boolean }): React.JSX.Element {
  const button =
    'app-no-drag flex h-10 w-[46px] items-center justify-center text-foreground/80 transition-colors'
  return (
    <div className="ml-2 flex self-stretch">
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
