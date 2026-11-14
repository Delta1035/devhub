import { useState } from 'react'
import { AlertCircle, Check, Code, Copy, FolderOpen, Play, RotateCw, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { RunRecord } from '@devhub/shared'
import { api } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useOpenProjectFolder } from '@renderer/features/projects/use-projects'
import { formatDuration, formatStartTime } from './use-run-history'
import { cn } from '@renderer/lib/utils'

interface RunDetailPanelProps {
  record: RunRecord
  scriptName: string
  onClose: () => void
  onRerun: () => void
  onViewFullLog: () => void
}

export function RunDetailPanel({
  record,
  scriptName,
  onClose,
  onRerun,
  onViewFullLog
}: RunDetailPanelProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const openFolder = useOpenProjectFolder()

  const output = useQuery({
    queryKey: ['run-output', record.projectId, record.scriptId, record.runId],
    queryFn: () => api.getRunHistoryOutput(record.projectId, record.scriptId, record.runId)
  })

  const rawData = output.data?.data ?? ''
  const isFailed = !record.stopped && record.exitCode !== 0 && record.exitCode !== null
  const isStopped = record.stopped || record.status === 'interrupted'

  const durationMs = record.endedAt
    ? Math.max(0, new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime())
    : 0

  const lines = rawData.split('\n')
  const tailLines = lines.slice(-25)

  const handleCopyLog = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(rawData)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard error
    }
  }

  const handleOpenEditor = (): void => {
    api.openInEditor(record.projectId, 'vscode').catch(() => undefined)
  }

  const handleOpenFolder = (): void => {
    openFolder.mutate(record.projectId)
  }

  return (
    <aside
      aria-label="运行详情面板"
      className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card/60 p-4"
    >
      {/* 面板头部 */}
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">运行详情</span>
          <span className="font-mono text-[11px] text-muted-foreground/70">
            #{record.runId.slice(0, 7)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="关闭详情面板"
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      </header>

      {/* 面板内容 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto py-3">
        {/* 名称与状态行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold text-foreground">{scriptName}</span>
            <Badge
              variant="secondary"
              className={cn(
                'h-4.5 px-1.5 text-[10px] font-normal border-0',
                isFailed && 'bg-destructive/15 text-destructive font-medium',
                isStopped && 'bg-secondary text-muted-foreground',
                !isFailed && !isStopped && 'bg-secondary text-foreground'
              )}
            >
              {isFailed ? `失败 · 退出码 ${record.exitCode ?? 1}` : isStopped ? '已中止' : '成功'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRerun}
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="size-3" />
            重新运行
          </Button>
        </div>

        {/* 元信息列表 */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">命令</span>
            <span className="truncate max-w-[200px] text-foreground" title={record.command}>
              {record.command}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">触发</span>
            <span className="text-muted-foreground">手动 · 本机用户</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">开始</span>
            <span className="text-muted-foreground">{formatStartTime(record.startedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">耗时</span>
            <span className="text-muted-foreground">{formatDuration(durationMs)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">退出码</span>
            <span className={cn(isFailed ? 'text-destructive font-bold' : 'text-muted-foreground')}>
              {record.exitCode ?? '—'}
            </span>
          </div>
        </div>

        {/* 失败摘要 */}
        {isFailed && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertCircle className="size-3.5" />
                <span>执行未通过</span>
              </div>
              <button
                type="button"
                onClick={handleOpenEditor}
                className="flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline"
              >
                <Code className="size-3" />
                打开编辑器
              </button>
            </div>
            <p className="font-mono text-[10px] text-destructive/80">
              {lines.find((l) => /error|fail|exception/i.test(l)) ??
                `进程退出码为 ${record.exitCode}`}
            </p>
          </div>
        )}

        {/* 日志尾部 */}
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">日志尾部</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchOpen(!searchOpen)}
                className="size-6 text-muted-foreground hover:text-foreground"
                title="搜索日志"
              >
                <Search className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopyLog}
                className="size-6 text-muted-foreground hover:text-foreground"
                title="复制日志"
              >
                {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              </Button>
              <button
                type="button"
                onClick={onViewFullLog}
                className="ml-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
              >
                查看全部日志
              </button>
            </div>
          </div>

          {searchOpen && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="在日志中查找…"
              className="h-6 w-full rounded border border-border bg-background px-2 text-[11px] text-foreground outline-none"
            />
          )}

          {/* 终端日志代码框 */}
          <div className="min-h-[160px] flex-1 overflow-auto rounded-lg border border-border bg-[#0B0D10] p-2.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground">
            {tailLines.length > 0 ? (
              tailLines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'truncate',
                    /error|fail/i.test(line) && 'text-destructive',
                    /ready|success|started/i.test(line) && 'text-primary'
                  )}
                >
                  {line || ' '}
                </div>
              ))
            ) : (
              <span className="text-muted-foreground/50">无输出日志</span>
            )}
          </div>
        </div>
      </div>

      {/* 面板底部按钮 */}
      <footer className="flex items-center gap-2 border-t border-border pt-3">
        <Button
          size="sm"
          onClick={onRerun}
          className="flex-1 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Play className="size-3" data-icon="inline-start" />
          重新运行 {scriptName}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleOpenFolder}
          title="打开所在文件夹"
          aria-label="打开所在文件夹"
          className="size-8 text-muted-foreground hover:text-foreground"
        >
          <FolderOpen className="size-3.5" />
        </Button>
      </footer>
    </aside>
  )
}
