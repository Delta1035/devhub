import { Copy, Minus, Settings as SettingsIcon, Square, X } from 'lucide-react'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { UpdateBadge } from '@renderer/features/updates/update-badge'
import { cn } from '@renderer/lib/utils'
import { useWindowState } from './use-window-state'

interface TitleBarProps {
  showSettings: boolean
  onToggleSettings: () => void
}

/**
 * Replaces the system title bar (ADR 0010): drags the window, and on Windows / Linux carries
 * the minimize / maximize / close buttons. macOS keeps its own traffic lights on the left.
 */
export function TitleBar({ showSettings, onToggleSettings }: TitleBarProps): React.JSX.Element {
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
      <img src="./favicon.svg" alt="" className="size-5" draggable={false} />
      <h1 className="font-heading text-sm font-semibold">DevHub</h1>
      {appInfo && <span className="text-xs text-muted-foreground">v{appInfo.version}</span>}
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
