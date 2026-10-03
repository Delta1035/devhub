import { useQuery } from '@tanstack/react-query'
import { stripAnsi, type RunRecord } from '@devhub/shared'
import { api } from '@renderer/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { formatStartTime } from './use-run-history'

export function HistoryLogDialog({
  record,
  scriptName,
  onClose
}: {
  record: RunRecord
  scriptName: string
  onClose: () => void
}): React.JSX.Element {
  const output = useQuery({
    queryKey: ['history-output', record.projectId, record.scriptId, record.runId],
    queryFn: () => api.getRunHistoryOutput(record.projectId, record.scriptId, record.runId)
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{scriptName} 的历史日志</DialogTitle>
          <DialogDescription className="break-words">
            {formatStartTime(record.startedAt)} · {record.command}
          </DialogDescription>
        </DialogHeader>
        {record.status === 'interrupted' && (
          <p className="text-xs text-muted-foreground">运行异常中断，最后一部分日志可能未保存。</p>
        )}
        {output.isPending ? (
          <p className="text-sm">读取中…</p>
        ) : output.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {output.error.message}
          </p>
        ) : output.data === null ? (
          <p className="text-sm text-muted-foreground">
            日志不可用：旧记录没有保存日志，或日志文件已丢失。
          </p>
        ) : (
          <>
            {output.data.truncated && (
              <p className="text-xs text-muted-foreground">日志已截断，仅保留最近 512 KB。</p>
            )}
            <pre
              aria-label="历史日志内容"
              tabIndex={0}
              className="min-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs select-text"
            >
              {output.data.data ? stripAnsi(output.data.data) : '本次运行没有输出'}
            </pre>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
