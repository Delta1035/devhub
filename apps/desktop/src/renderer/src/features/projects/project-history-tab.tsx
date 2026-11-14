import { useState } from 'react'
import { ArrowDownWideNarrow, FileText, History, Trash2 } from 'lucide-react'
import type { Project, RunRecord, Script } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { HistoryLogDialog } from '@renderer/features/runs/history-log-dialog'
import {
  formatDuration,
  formatStartTime,
  useClearRunHistory,
  useRunHistory
} from '@renderer/features/runs/use-run-history'
import { cn } from '@renderer/lib/utils'

interface ProjectHistoryTabProps {
  project: Project
  scripts: Script[]
}

type StatusFilter = 'all' | 'success' | 'failed' | 'stopped'

export function ProjectHistoryTab({ project, scripts }: ProjectHistoryTabProps): React.JSX.Element {
  const [selectedScriptId, setSelectedScriptId] = useState<string>(scripts[0]?.id ?? '')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewLogRecord, setViewLogRecord] = useState<RunRecord | null>(null)

  const selectedScript = scripts.find((s) => s.id === selectedScriptId) ?? scripts[0]
  const history = useRunHistory(project.id, selectedScript?.id ?? '', Boolean(selectedScript))
  const clearHistory = useClearRunHistory(project.id, selectedScript?.id ?? '')

  const rawRecords = history.data ?? []

  // Status classification
  const isFailed = (r: RunRecord): boolean => !r.stopped && r.exitCode !== 0 && r.exitCode !== null
  const isStopped = (r: RunRecord): boolean => r.stopped || r.status === 'interrupted'
  const isSuccess = (r: RunRecord): boolean => !isFailed(r) && !isStopped(r)

  const successCount = rawRecords.filter(isSuccess).length
  const failedCount = rawRecords.filter(isFailed).length
  const stoppedCount = rawRecords.filter(isStopped).length

  const filteredRecords = rawRecords.filter((record) => {
    if (statusFilter === 'success') return isSuccess(record)
    if (statusFilter === 'failed') return isFailed(record)
    if (statusFilter === 'stopped') return isStopped(record)
    return true
  })

  return (
    <div className="flex h-full flex-col gap-3 p-4 md:p-6">
      {/* Header aligned with pen/devhub.pen */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-semibold text-foreground">运行历史</h3>
            <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
              {project.name}
            </span>
            {selectedScript && (
              <span className="rounded border border-border/80 bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {selectedScript.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            每个脚本保留最近 20 次运行与完整日志，DevHub 重启后依然可查。
          </p>
        </div>

        {selectedScript && rawRecords.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearHistory.mutate()}
            disabled={clearHistory.isPending}
            className="h-8 gap-1.5 border-border px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            清空历史
          </Button>
        )}
      </header>

      {/* Script Selection Pills */}
      {scripts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">脚本：</span>
          {scripts.map((script) => (
            <button
              key={script.id}
              type="button"
              onClick={() => setSelectedScriptId(script.id)}
              className={cn(
                'rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors',
                (selectedScript?.id ?? '') === script.id
                  ? 'bg-accent text-[#06130D]'
                  : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {script.name}
            </button>
          ))}
        </div>
      )}

      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-y border-border/60 py-2 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
            statusFilter === 'all'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>全部</span>
          <span className="font-mono text-[10px] opacity-75">{rawRecords.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('success')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
            statusFilter === 'success'
              ? 'bg-accent/15 text-accent'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>成功</span>
          <span className="font-mono text-[10px] opacity-75">{successCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('failed')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
            statusFilter === 'failed'
              ? 'bg-destructive/15 text-destructive'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>失败</span>
          <span className="font-mono text-[10px] opacity-75">{failedCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('stopped')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium transition-colors',
            statusFilter === 'stopped'
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>已中止</span>
          <span className="font-mono text-[10px] opacity-75">{stoppedCount}</span>
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
          <ArrowDownWideNarrow className="size-3" />
          <span>按开始时间倒序</span>
        </div>
      </div>

      {/* History Table */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/80 bg-card/60">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <History className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {history.isPending
                ? '正在加载运行记录…'
                : rawRecords.length === 0
                  ? '该脚本暂无历史运行记录'
                  : '没有符合当前筛选条件的记录'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/80 bg-secondary/40 text-[11px] font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">脚本</th>
                <th className="px-4 py-2.5">命令详情</th>
                <th className="px-4 py-2.5">开始时间</th>
                <th className="px-4 py-2.5 font-mono">耗时</th>
                <th className="px-4 py-2.5">状态</th>
                <th className="px-4 py-2.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {filteredRecords.map((record) => {
                const failed = isFailed(record)
                const stopped = isStopped(record)
                const durationMs = record.endedAt
                  ? Math.max(
                      0,
                      new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()
                    )
                  : 0

                return (
                  <tr key={record.runId} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {selectedScript?.name ?? record.scriptId}
                    </td>

                    <td
                      className="max-w-xs truncate px-4 py-3 text-muted-foreground"
                      title={record.command}
                    >
                      {record.command}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      {formatStartTime(record.startedAt)}
                    </td>

                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatDuration(durationMs)}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        variant={failed ? 'destructive' : stopped ? 'secondary' : 'default'}
                        className={cn(
                          'h-5 gap-1 px-2 text-[10px]',
                          !failed &&
                            !stopped &&
                            'border-transparent bg-accent/15 text-accent hover:bg-accent/20'
                        )}
                      >
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            !failed && !stopped && 'bg-accent',
                            failed && 'bg-destructive',
                            stopped && 'bg-muted-foreground'
                          )}
                        />
                        {failed
                          ? `失败 (${record.exitCode ?? '未知'})`
                          : stopped
                            ? '已中止'
                            : '成功'}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setViewLogRecord(record)}
                        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <FileText className="size-3" />
                        查看日志
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewLogRecord && (
        <HistoryLogDialog
          record={viewLogRecord}
          scriptName={selectedScript?.name ?? viewLogRecord.scriptId}
          onClose={() => setViewLogRecord(null)}
        />
      )}
    </div>
  )
}
