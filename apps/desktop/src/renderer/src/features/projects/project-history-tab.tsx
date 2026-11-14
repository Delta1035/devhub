import { useState } from 'react'
import { CheckCircle2, History, Trash2, XCircle } from 'lucide-react'
import type { Project, RunRecord, Script } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { HistoryLogDialog } from '@renderer/features/runs/history-log-dialog'
import {
  formatDuration,
  formatStartTime,
  useClearRunHistory,
  useRunHistory
} from '@renderer/features/runs/use-run-history'

interface ProjectHistoryTabProps {
  project: Project
  scripts: Script[]
}

export function ProjectHistoryTab({ project, scripts }: ProjectHistoryTabProps): React.JSX.Element {
  const [selectedScriptId, setSelectedScriptId] = useState<string>(scripts[0]?.id ?? '')
  const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? scripts[0]
  const history = useRunHistory(project.id, selectedScript?.id ?? '', Boolean(selectedScript))
  const clearHistory = useClearRunHistory(project.id, selectedScript?.id ?? '')
  const [viewLogRecord, setViewLogRecord] = useState<RunRecord | null>(null)

  const records = history.data ?? []

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">运行历史记录</h3>
          {selectedScript && (
            <span className="font-mono text-xs text-muted-foreground">({selectedScript.name})</span>
          )}
        </div>

        {selectedScript && records.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearHistory.mutate()}
            disabled={clearHistory.isPending}
            className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3" />
            清空此脚本记录
          </Button>
        )}
      </header>

      {/* Script Pills */}
      {scripts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {scripts.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => setSelectedScriptId(script.id)}
              className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors ${
                (selectedScript?.id ?? '') === script.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {script.name}
            </button>
          ))}
        </div>
      )}

      {/* History Records Table */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/80 bg-card">
        {records.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            {history.isPending ? '正在加载历史记录…' : '该脚本暂无已完成的运行记录'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {records.map((record) => {
              const failed = !record.stopped && record.exitCode !== 0
              const durationMs = record.endedAt
                ? Math.max(
                    0,
                    new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()
                  )
                : 0
              return (
                <li
                  key={record.runId}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {failed ? (
                      <XCircle className="size-4 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">
                          {selectedScript?.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatStartTime(record.startedAt)}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        耗时 {formatDuration(durationMs)} ·{' '}
                        {record.stopped
                          ? '已停止'
                          : record.exitCode !== null
                            ? `退出码 ${record.exitCode}`
                            : '正常退出'}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewLogRecord(record)}
                    className="h-7 px-2 text-xs"
                  >
                    查看日志
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {viewLogRecord && selectedScript && (
        <HistoryLogDialog
          record={viewLogRecord}
          scriptName={selectedScript.name}
          onClose={() => setViewLogRecord(null)}
        />
      )}
    </div>
  )
}
