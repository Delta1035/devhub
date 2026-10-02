import { useState } from 'react'
import { History } from 'lucide-react'
import type { RunRecord } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import { formatDuration, formatStartTime, useRunHistory } from './use-run-history'

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

  return (
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
        className="w-80 gap-0 p-0"
        aria-label={`${scriptName} 的运行历史`}
      >
        <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">最近的运行</p>
        {history.isPending ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">读取中…</p>
        ) : history.isError ? (
          <p className="px-3 py-4 text-center text-xs text-destructive">{history.error.message}</p>
        ) : history.data.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">还没有结束过的运行</p>
        ) : (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {history.data.map((record) => (
              <RecordRow key={record.runId} record={record} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function RecordRow({ record }: { record: RunRecord }): React.JSX.Element {
  const duration = new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()
  const { label, tone } = outcome(record)
  return (
    <li className="flex items-center gap-3 px-3 py-1.5 text-xs" title={record.command}>
      <span className="w-24 shrink-0 tabular-nums">{formatStartTime(record.startedAt)}</span>
      <span className="flex-1 text-muted-foreground tabular-nums">{formatDuration(duration)}</span>
      <span
        className={cn(
          'shrink-0',
          tone === 'failed' && 'font-medium text-destructive',
          tone === 'muted' && 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </li>
  )
}

function outcome(record: RunRecord): { label: string; tone: 'ok' | 'failed' | 'muted' } {
  if (record.stopped) return { label: '已停止', tone: 'muted' }
  if (record.exitCode === 0) return { label: '已完成', tone: 'ok' }
  return { label: `退出码 ${record.exitCode ?? '未知'}`, tone: 'failed' }
}
