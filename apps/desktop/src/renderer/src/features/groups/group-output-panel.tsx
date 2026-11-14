import { useState } from 'react'
import { Check, Copy, ScrollText } from 'lucide-react'
import type { Group, GroupRunState, Project, Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface GroupOutputPanelProps {
  group: Group
  state: GroupRunState | undefined
  projects: Project[]
  runs: Run[]
}

interface LogEntry {
  id: string
  time: string
  stepTag?: string
  text: string
  type: 'info' | 'success' | 'danger' | 'muted'
}

export function GroupOutputPanel({
  group,
  state,
  projects,
  runs
}: GroupOutputPanelProps): React.JSX.Element {
  const [onlyFailures, setOnlyFailures] = useState(false)
  const [copied, setCopied] = useState(false)

  // Construct synthetic timeline logs from steps and run states
  const logs: LogEntry[] = []

  if (state) {
    state.steps.forEach((stepProg, idx) => {
      const stepDef = group.steps.find((s) => s.id === stepProg.stepId)
      const project = projects.find((p) => p.id === stepDef?.projectId)
      const run = stepProg.runId ? runs.find((r) => r.id === stepProg.runId) : undefined
      const scriptName =
        run?.title ??
        (stepDef?.scriptId
          ? stepDef.scriptId.slice(stepDef.scriptId.indexOf(':') + 1)
          : `步骤 ${idx + 1}`)
      const projName = project?.name ?? '项目'
      const tag = `[${idx + 1}/${group.steps.length}]`
      const time = run?.startedAt
        ? new Date(run.startedAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : '--:--:--'

      if (stepProg.state === 'running') {
        logs.push({
          id: `${stepProg.stepId}-start`,
          time,
          stepTag: tag,
          text: `${projName} · ${scriptName} → 启动中...`,
          type: 'info'
        })
      } else if (stepProg.state === 'done') {
        logs.push({
          id: `${stepProg.stepId}-done`,
          time,
          stepTag: tag,
          text: `✓ ${projName} · ${scriptName} 条件已满足就绪`,
          type: 'success'
        })
      } else if (stepProg.state === 'failed') {
        logs.push({
          id: `${stepProg.stepId}-fail`,
          time,
          stepTag: tag,
          text: `✗ ${projName} · ${scriptName} 失败: ${stepProg.message ?? '异常退出'}`,
          type: 'danger'
        })
      } else if (stepProg.state === 'cancelled') {
        logs.push({
          id: `${stepProg.stepId}-cancel`,
          time,
          stepTag: tag,
          text: `⊘ ${projName} · ${scriptName} 已取消执行`,
          type: 'muted'
        })
      }
    })
  }

  const displayedLogs = onlyFailures ? logs.filter((l) => l.type === 'danger') : logs

  const handleCopy = async (): Promise<void> => {
    const textToCopy = displayedLogs
      .map((l) => `${l.time} ${l.stepTag ? l.stepTag + ' ' : ''}${l.text}`)
      .join('\n')
    await navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col border-t border-border bg-[#080A0D]">
      {/* Header */}
      <div className="flex h-8 items-center gap-2 border-b border-border bg-[#0C0F13] px-4 text-xs md:px-6">
        <ScrollText className="size-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          任务输出
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setOnlyFailures(!onlyFailures)}
          className={cn(
            'rounded px-2 py-0.5 text-[11px] transition-colors',
            onlyFailures
              ? 'bg-destructive/20 text-destructive font-medium'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          仅看失败
        </button>

        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          disabled={displayedLogs.length === 0}
          title="复制输出"
          aria-label="复制输出"
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3 text-accent" /> : <Copy className="size-3" />}
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-48 min-h-24 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed md:px-6">
        {displayedLogs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/60">
            {onlyFailures ? '暂无失败日志' : '任务启动后，各步骤的输出状态将在此处实时汇聚'}
          </p>
        ) : (
          <div className="space-y-1">
            {displayedLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="shrink-0 text-muted-foreground/50">{log.time}</span>
                {log.stepTag && (
                  <span className="shrink-0 text-muted-foreground">{log.stepTag}</span>
                )}
                <span
                  className={cn(
                    'break-all',
                    log.type === 'success' && 'text-accent',
                    log.type === 'danger' && 'text-destructive font-medium',
                    log.type === 'info' && 'text-info',
                    log.type === 'muted' && 'text-muted-foreground'
                  )}
                >
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
