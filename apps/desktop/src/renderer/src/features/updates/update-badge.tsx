import { ArrowDownCircle, RotateCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { updateActions, useUpdateStatus } from './use-update'

/** Shown in the top bar only when there is something to do about an update. */
export function UpdateBadge(): React.JSX.Element | null {
  const status = useUpdateStatus()
  if (status?.state === 'available') {
    return (
      <Button size="sm" variant="secondary" onClick={() => void updateActions.download()}>
        <ArrowDownCircle data-icon="inline-start" />
        新版本 {status.version}
      </Button>
    )
  }
  if (status?.state === 'downloading') {
    return <span className="text-xs text-muted-foreground">正在下载 {status.percent}%</span>
  }
  if (status?.state === 'downloaded') {
    return (
      <Button
        size="sm"
        onClick={() => void updateActions.install()}
        title="会先停止所有运行中的脚本和终端"
      >
        <RotateCw data-icon="inline-start" />
        重启并更新到 {status.version}
      </Button>
    )
  }
  return null
}
