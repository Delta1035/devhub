import type { UpdateStatus } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { updateActions, useUpdateStatus } from '@renderer/features/updates/use-update'
import { SettingRow, SettingsSection } from './settings-controls'

function describe(status: UpdateStatus | null): string {
  switch (status?.state) {
    case undefined:
      return '读取中…'
    case 'unsupported':
      return status.reason
    case 'idle':
      return '尚未检查'
    case 'checking':
      return '正在检查…'
    case 'up-to-date':
      return `已是最新版本（${new Date(status.checkedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 检查）`
    case 'available':
      return `有新版本 ${status.version}`
    case 'downloading':
      return `正在下载 ${status.version}：${status.percent}%`
    case 'downloaded':
      return `${status.version} 已下载，重启后生效`
    case 'error':
      return `检查失败：${status.message}`
  }
}

export function UpdatesSection(): React.JSX.Element {
  const appInfo = useAppInfo()
  const status = useUpdateStatus()
  const busy = status?.state === 'checking' || status?.state === 'downloading'

  return (
    <SettingsSection title="关于与更新">
      <SettingRow
        label={`DevHub ${appInfo.data ? `v${appInfo.data.version}` : ''}`}
        description={<span role="status">{describe(status)}</span>}
      >
        {status?.state === 'available' && (
          <Button size="sm" onClick={() => void updateActions.download()}>
            下载更新
          </Button>
        )}
        {status?.state === 'downloaded' && (
          <Button size="sm" onClick={() => void updateActions.install()}>
            重启并更新
          </Button>
        )}
        {status && status.state !== 'unsupported' && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void updateActions.check()}
          >
            检查更新
          </Button>
        )}
      </SettingRow>
    </SettingsSection>
  )
}
