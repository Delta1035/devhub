import { useState } from 'react'
import { History } from 'lucide-react'
import type { RunRecord } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import {
  formatDuration,
  formatStartTime,
  useRunHistory,
  useClearRunHistory
} from './use-run-history'
import { HistoryLogDialog } from './history-log-dialog'

interface RunHistoryButtonProps {
  projectId: string
  scriptId: string
  scriptName: string
}

/** Lists how the script's recent runs ended: when, for how long, and with what result. */
export function RunHistoryButton({
  projectId,
  scriptId,
  scriptName
}: RunHistoryButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const history = useRunHistory(projectId, scriptId, open)
  const clear = useClearRunHistory(projectId, scriptId)
  const [viewing, setViewing] = useState<RunRecord | null>(null)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            title="运行历史"
            aria-label={`${scriptName} 的运行历史`}
          >
            <History />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-96 gap-0 p-0"
          aria-label={`${scriptName} 的运行历史`}
        >
          <header className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">最近的运行</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!history.data?.length || clear.isPending}
              title="清空已结束的记录与日志，不会停止当前运行"
              onClick={() => clear.mutate()}
            >
              清空历史
            </Button>
          </header>
          {clear.isError && (
            <p role="alert" className="px-3 py-2 text-xs text-destructive">
              {clear.error.message}
            </p>
          )}
          {history.isPending ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">读取中…</p>
          ) : history.isError ? (
            <p className="px-3 py-4 text-center text-xs text-destructive">
              {history.error.message}
            </p>
          ) : history.data.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              还没有结束过的运行
            </p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto">
              {history.data.map((record) => (
                <RecordRow
                  key={record.runId}
                  record={record}
                  onView={() => {
                    setOpen(false)
                    setViewing(record)
                  }}
                />
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      {viewing && (
        <HistoryLogDialog
          record={viewing}
          scriptName={scriptName}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}

function RecordRow({
  record,
  onView
}: {
  record: RunRecord
  onView: () => void
}): React.JSX.Element {
  const duration = record.endedAt
    ? new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()
    : null
  const { label, tone } = outcome(record)
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs" title={record.command}>
      <span className="w-24 shrink-0 tabular-nums">{formatStartTime(record.startedAt)}</span>
      <span className="flex-1 text-muted-foreground tabular-nums">
        {duration === null ? '时长未知' : formatDuration(duration)}
      </span>
      <span
        className={cn(
          'shrink-0',
          tone === 'failed' && 'font-medium text-destructive',
          tone === 'muted' && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
      <Button variant="ghost" size="sm" onClick={onView}>
        查看日志
      </Button>
    </li>
  )
}

function outcome(record: RunRecord): { label: string; tone: 'ok' | 'failed' | 'muted' } {
  if (record.status === 'interrupted') return { label: '异常中断', tone: 'failed' }
  if (record.stopped) return { label: '已停止', tone: 'muted' }
  if (record.exitCode === 0) return { label: '已完成', tone: 'ok' }
  return { label: `退出码 ${record.exitCode ?? '未知'}`, tone: 'failed' }
}
