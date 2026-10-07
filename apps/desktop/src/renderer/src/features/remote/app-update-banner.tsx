import { useState, useSyncExternalStore } from 'react'
import { Download, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { appUpdates } from '@renderer/api'
import type { AppUpdateState, AppUpdates } from '@renderer/api/app-update'
import { Button } from '@renderer/components/ui/button'

const releasesUrl = 'https://github.com/Delta1035/devhub/releases'

const idle: AppUpdateState = { state: 'idle' }

/**
 * Remote clients only: the Android app's live update progress (ADR 0030), and a warning when the
 * desktop speaks another remote protocol than this client.
 */
export function AppUpdateBanner({
  behind
}: {
  behind: 'desktop' | 'app' | null
}): React.JSX.Element | null {
  const update = useAppUpdate(appUpdates)
  const [protocolDismissed, setProtocolDismissed] = useState(false)

  const content = describe(update, behind && !protocolDismissed ? behind : null)
  if (!content) return null
  return (
    <div
      role="status"
      className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-w-md items-center gap-2 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
    >
      {content.icon}
      <p className="flex-1">{content.text}</p>
      {content.action}
      <Button
        size="icon"
        variant="ghost"
        aria-label="关闭"
        onClick={() =>
          update.state === 'idle' ? setProtocolDismissed(true) : appUpdates?.dismiss()
        }
      >
        <X />
      </Button>
    </div>
  )
}

function useAppUpdate(updates: AppUpdates | null): AppUpdateState {
  return useSyncExternalStore(
    (listener) => updates?.subscribe(listener) ?? (() => undefined),
    () => updates?.get() ?? idle
  )
}

function describe(
  update: AppUpdateState,
  behind: 'desktop' | 'app' | null
): { icon: React.ReactNode; text: string; action?: React.ReactNode } | null {
  switch (update.state) {
    case 'downloading':
      return { icon: <Download className="size-4" />, text: `正在下载 ${update.version} 版界面…` }
    case 'ready':
      return {
        icon: <RefreshCw className="size-4" />,
        text: `${update.version} 版界面已就绪，重启后生效`,
        action: (
          <Button size="sm" onClick={() => appUpdates?.restart()}>
            立即重启
          </Button>
        )
      }
    case 'install-apk':
      return {
        icon: <TriangleAlert className="size-4" />,
        text: `桌面端 ${update.version} 需要新版 App`,
        action: (
          <Button size="sm" asChild>
            <a href={releasesUrl} target="_blank" rel="noreferrer">
              下载
            </a>
          </Button>
        )
      }
    case 'failed':
      return { icon: <TriangleAlert className="size-4" />, text: update.message }
    case 'idle':
      if (behind === 'desktop') {
        return {
          icon: <TriangleAlert className="size-4" />,
          text: '桌面端版本较旧，部分功能可能无法使用，请升级桌面端'
        }
      }
      if (behind === 'app') {
        return {
          icon: <TriangleAlert className="size-4" />,
          text: 'App 版本较旧，部分功能可能无法使用，请更新 App'
        }
      }
      return null
  }
}
