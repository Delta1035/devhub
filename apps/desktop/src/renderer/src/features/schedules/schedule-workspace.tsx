import { useState } from 'react'
import { CalendarClock, Clock3, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import type { Group, Project, Schedule } from '@devhub/shared'
import { access } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useGroups } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { ScheduleEditor } from './schedule-editor'
import {
  useDeleteSchedule,
  useRunScheduleNow,
  useSchedules,
  useSetScheduleEnabled
} from './use-schedules'

export function ScheduleWorkspace(): React.JSX.Element {
  const schedules = useSchedules().data ?? []
  const projects = useProjects().data ?? []
  const groups = useGroups().data ?? []
  const [editing, setEditing] = useState<Schedule | null | undefined>(undefined)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-3 md:px-6 md:py-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            定时任务
          </h1>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            按计划启动脚本或批量任务。DevHub 退出后不会执行，也不会补执行错过的计划。
          </p>
        </div>
        {access.manage && (
          <Button
            size="sm"
            onClick={() => setEditing(null)}
            className="h-8 gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            新建定时任务
          </Button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
        {schedules.length === 0 ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
              <CalendarClock className="size-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">还没有定时任务</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                可以定时运行单个脚本，也可以定时启动已有批量任务。
              </p>
            </div>
            {access.manage && (
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                <Plus data-icon="inline-start" /> 新建第一个任务
              </Button>
            )}
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-3" aria-label="定时任务列表">
            {schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                projects={projects}
                groups={groups}
                onEdit={() => setEditing(schedule)}
              />
            ))}
          </div>
        )}
      </main>

      {editing !== undefined && (
        <ScheduleEditor schedule={editing} onClose={() => setEditing(undefined)} />
      )}
    </div>
  )
}

function ScheduleCard({
  schedule,
  projects,
  groups,
  onEdit
}: {
  schedule: Schedule
  projects: Project[]
  groups: Group[]
  onEdit: () => void
}): React.JSX.Element {
  const toggle = useSetScheduleEnabled()
  const runNow = useRunScheduleNow()
  const remove = useDeleteSchedule()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const target = targetLabel(schedule, projects, groups)
  const last = schedule.lastResult

  const toggleEnabled = (): void => {
    toggle.mutate(
      { scheduleId: schedule.id, enabled: !schedule.enabled },
      { onError: (error) => toast.error(error.message) }
    )
  }

  const executeNow = (): void => {
    runNow.mutate(schedule.id, {
      onSuccess: (updated) =>
        toast[updated.lastResult?.status === 'skipped' ? 'info' : 'success'](
          updated.lastResult?.message ?? '已触发定时任务'
        ),
      onError: (error) => toast.error(error.message)
    })
  }

  const deleteSchedule = (): void => {
    if (!confirmingDelete) return setConfirmingDelete(true)
    remove.mutate(schedule.id, {
      onSuccess: () => toast.success(`已删除定时任务「${schedule.name}」`),
      onError: (error) => toast.error(error.message)
    })
  }

  return (
    <article
      aria-label={`定时任务 ${schedule.name}`}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-xs transition-colors',
        schedule.enabled ? 'border-border' : 'border-border/60 opacity-70'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock3 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{schedule.name}</h2>
              <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                {schedule.enabled ? '已启用' : '已停用'}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{target}</p>
          </div>
        </div>
        {access.manage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={executeNow}
              disabled={runNow.isPending}
              aria-label={`立即执行 ${schedule.name}`}
              title="立即执行"
            >
              <Play className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onEdit}
              aria-label={`编辑 ${schedule.name}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant={confirmingDelete ? 'destructive' : 'ghost'}
              onClick={deleteSchedule}
              disabled={remove.isPending}
              aria-label={confirmingDelete ? `确认删除 ${schedule.name}` : `删除 ${schedule.name}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 border-t border-border/60 pt-3 text-xs sm:grid-cols-3">
        <div>
          <span className="block text-muted-foreground">执行规则</span>
          <span className="mt-1 block font-medium">{formatRule(schedule)}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">下一次执行</span>
          <span className="mt-1 block font-medium">
            {schedule.enabled && schedule.nextRunAt ? formatDate(schedule.nextRunAt) : '未计划'}
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">最近结果</span>
          <span className="mt-1 block font-medium">
            {last ? `${resultLabel(last.status)} · ${formatDate(last.at)}` : '暂无执行记录'}
          </span>
          {last?.message && (
            <span className="mt-0.5 block text-muted-foreground">{last.message}</span>
          )}
        </div>
      </div>

      {access.manage && (
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">
            冲突策略：{schedule.overlapPolicy === 'skip' ? '跳过本次' : '停止后重新执行'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={schedule.enabled}
            onClick={toggleEnabled}
            className="text-xs font-medium text-primary hover:underline"
          >
            {schedule.enabled ? '停用' : '启用'}
          </button>
        </div>
      )}
    </article>
  )
}

function targetLabel(schedule: Schedule, projects: Project[], groups: Group[]): string {
  const target = schedule.target
  if (target.kind === 'group') {
    return `批量任务 · ${groups.find((group) => group.id === target.groupId)?.name ?? '目标已删除'}`
  }
  const project = projects.find((candidate) => candidate.id === target.projectId)
  return `脚本 · ${project?.name ?? '项目已删除'} / ${target.scriptId}`
}

function formatRule(schedule: Schedule): string {
  const { rule } = schedule
  if (rule.kind === 'once') return `单次 · ${formatDate(rule.at)}`
  if (rule.kind === 'daily') return `每天 ${rule.time}`
  if (rule.kind === 'weekly')
    return `每周 ${rule.days.map((day) => ['日', '一', '二', '三', '四', '五', '六'][day]).join('、')} ${rule.time}`
  if (rule.kind === 'interval') return `每 ${rule.minutes} 分钟`
  return `Cron · ${rule.expression}`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso))
}

function resultLabel(status: 'started' | 'skipped' | 'failed'): string {
  if (status === 'started') return '已触发'
  if (status === 'skipped') return '已跳过'
  return '失败'
}
