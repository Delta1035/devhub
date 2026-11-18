import { useState } from 'react'
import type { Project, Schedule } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useGroups } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { useSaveSchedule } from './use-schedules'
import {
  defaultScheduleDraft,
  draftFromSchedule,
  toScheduleInput,
  type DraftRuleKind,
  type ScheduleDraft
} from './schedule-draft'

interface ScheduleEditorProps {
  schedule: Schedule | null
  onClose: () => void
}

const ruleOptions: { value: DraftRuleKind; label: string }[] = [
  { value: 'once', label: '单次' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'interval', label: '固定间隔' },
  { value: 'cron', label: 'Cron' }
]
const weekdays = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' }
]

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

export function ScheduleEditor({ schedule, onClose }: ScheduleEditorProps): React.JSX.Element {
  const projects = useProjects().data ?? []
  const groups = useGroups().data ?? []
  const [draft, setDraft] = useState<ScheduleDraft>(() =>
    schedule ? draftFromSchedule(schedule) : defaultScheduleDraft()
  )
  const scripts = useProjectScripts(draft.projectId).data?.scripts ?? []
  const save = useSaveSchedule()
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<ScheduleDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }))

  const submit = (): void => {
    const result = toScheduleInput(draft, schedule?.id)
    if ('error' in result) return setError(result.error)
    setError(null)
    save.mutate(result.input, {
      onSuccess: () => {
        toast.success(schedule ? '已保存定时任务修改' : '已创建定时任务')
        onClose()
      },
      onError: (failure) => setError(failure.message)
    })
  }

  const toggleWeekday = (day: number): void => {
    const days = draft.days.includes(day)
      ? draft.days.filter((value) => value !== day)
      : [...draft.days, day].sort((a, b) => a - b)
    update({ days })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{schedule ? '编辑定时任务' : '新建定时任务'}</DialogTitle>
          <DialogDescription>按计划启动单个脚本或已有批量任务。</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-name">名称</Label>
            <Input
              id="schedule-name"
              value={draft.name}
              placeholder="如工作日构建"
              onChange={(event) => update({ name: event.target.value })}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">执行目标</legend>
            <select
              className={selectClass}
              aria-label="执行目标类型"
              value={draft.targetKind}
              onChange={(event) =>
                update({ targetKind: event.target.value as ScheduleDraft['targetKind'] })
              }
            >
              <option value="script">单个项目脚本</option>
              <option value="group">批量任务</option>
            </select>
            {draft.targetKind === 'script' ? (
              <ScriptTarget draft={draft} projects={projects} scripts={scripts} update={update} />
            ) : (
              <select
                className={selectClass}
                aria-label="批量任务"
                value={draft.groupId}
                onChange={(event) => update({ groupId: event.target.value })}
              >
                <option value="">选择批量任务</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">执行时间</legend>
            <select
              className={selectClass}
              aria-label="时间规则"
              value={draft.ruleKind}
              onChange={(event) => update({ ruleKind: event.target.value as DraftRuleKind })}
            >
              {ruleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {draft.ruleKind === 'once' && (
              <Input
                type="datetime-local"
                aria-label="执行时间"
                value={draft.onceAt}
                onChange={(event) => update({ onceAt: event.target.value })}
              />
            )}
            {(draft.ruleKind === 'daily' || draft.ruleKind === 'weekly') && (
              <Input
                type="time"
                aria-label="执行时间"
                value={draft.time}
                onChange={(event) => update({ time: event.target.value })}
              />
            )}
            {draft.ruleKind === 'weekly' && (
              <div className="flex gap-1.5" aria-label="每周执行日">
                {weekdays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={draft.days.includes(day.value)}
                    onClick={() => toggleWeekday(day.value)}
                    className={cn(
                      'size-8 rounded-full border text-xs transition-colors',
                      draft.days.includes(day.value)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
            {draft.ruleKind === 'interval' && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={525600}
                  aria-label="间隔分钟数"
                  value={draft.intervalMinutes}
                  onChange={(event) => update({ intervalMinutes: event.target.value })}
                />
                <span className="shrink-0 text-sm text-muted-foreground">分钟</span>
              </div>
            )}
            {draft.ruleKind === 'cron' && (
              <div className="flex flex-col gap-1">
                <Input
                  aria-label="Cron 表达式"
                  value={draft.cron}
                  placeholder="分 时 日 月 周"
                  onChange={(event) => update({ cron: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">标准 5 段格式，例如 `0 9 * * 1-5`。</p>
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">目标正在运行时</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <PolicyButton
                selected={draft.overlapPolicy === 'skip'}
                onClick={() => update({ overlapPolicy: 'skip' })}
                title="跳过本次"
                hint="默认策略，不打断当前运行"
              />
              <PolicyButton
                selected={draft.overlapPolicy === 'stop-and-restart'}
                onClick={() => update({ overlapPolicy: 'stop-and-restart' })}
                title="停止后重新执行"
                hint="会停止对应脚本或批量任务"
              />
            </div>
          </fieldset>

          <label className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => update({ enabled: event.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block font-medium text-foreground">启用定时任务</span>
              DevHub 退出后不会执行任务，也不会在下次启动时补执行错过的计划。
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScriptTarget({
  draft,
  projects,
  scripts,
  update
}: {
  draft: ScheduleDraft
  projects: Project[]
  scripts: { id: string; name: string }[]
  update: (patch: Partial<ScheduleDraft>) => void
}): React.JSX.Element {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select
        className={selectClass}
        aria-label="项目"
        value={draft.projectId}
        onChange={(event) => update({ projectId: event.target.value, scriptId: '' })}
      >
        <option value="">选择项目</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        aria-label="脚本"
        value={draft.scriptId}
        onChange={(event) => update({ scriptId: event.target.value })}
        disabled={!draft.projectId}
      >
        <option value="">选择脚本</option>
        {scripts.map((script) => (
          <option key={script.id} value={script.id}>
            {script.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function PolicyButton({
  selected,
  onClick,
  title,
  hint
}: {
  selected: boolean
  onClick: () => void
  title: string
  hint: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  )
}
