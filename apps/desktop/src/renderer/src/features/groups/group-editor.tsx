import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Group, GroupMode } from '@devhub/shared'
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
import { useProjects } from '@renderer/features/projects/use-projects'
import { cn } from '@renderer/lib/utils'
import { draftFromGroup, emptyStep, toGroupInput, type GroupDraft } from './group-draft'
import { GroupStepRow } from './group-step-row'
import { useDeleteGroup, useSaveGroup } from './use-groups'

interface GroupEditorProps {
  /** The group to edit, or null to create one. */
  group: Group | null
  /** Pre-selected project for the first step of a new group. */
  defaultProjectId?: string
  onClose: () => void
}

const modes: { value: GroupMode; label: string; hint: string }[] = [
  { value: 'parallel', label: '并行', hint: '同时启动所有脚本' },
  { value: 'serial', label: '串行', hint: '按顺序启动，上一步满足条件后再启动下一步' }
]

export function GroupEditor({
  group,
  defaultProjectId,
  onClose
}: GroupEditorProps): React.JSX.Element {
  const projects = useProjects().data ?? []
  const save = useSaveGroup()
  const remove = useDeleteGroup()
  const [draft, setDraft] = useState<GroupDraft>(() =>
    group
      ? draftFromGroup(group)
      : { name: '', mode: 'parallel', steps: [emptyStep(defaultProjectId)] }
  )
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  /** Applies an edit to a copy of the step list. */
  const updateSteps = (update: (steps: GroupDraft['steps']) => void): void => {
    const steps = [...draft.steps]
    update(steps)
    setDraft({ ...draft, steps })
  }

  const submit = (): void => {
    const result = toGroupInput(draft)
    if ('error' in result) return setError(result.error)
    setError(null)
    save.mutate(result.input, {
      onSuccess: onClose,
      onError: (failure) => setError(failure.message)
    })
  }

  const deleteGroup = (): void => {
    if (!group) return
    if (!confirmingDelete) return setConfirmingDelete(true)
    remove.mutate(group.id, { onSuccess: onClose, onError: (failure) => setError(failure.message) })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{group ? '编辑批量任务' : '新建批量任务'}</DialogTitle>
          <DialogDescription>把多个项目的脚本组合在一起，一键启动或停止。</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">名称</Label>
            <Input
              id="group-name"
              value={draft.name}
              placeholder="如 front1"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">执行方式</legend>
            <div className="flex gap-2">
              {modes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={draft.mode === mode.value}
                  onClick={() => setDraft({ ...draft, mode: mode.value })}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-left text-sm',
                    draft.mode === mode.value ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  )}
                >
                  <span className="font-medium">{mode.label}</span>
                  <span className="block text-xs text-muted-foreground">{mode.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">步骤</span>
            <ol className="flex flex-col gap-2">
              {draft.steps.map((step, index) => (
                <GroupStepRow
                  key={step.key}
                  index={index}
                  step={step}
                  projects={projects}
                  serial={draft.mode === 'serial'}
                  isFirst={index === 0}
                  isLast={index === draft.steps.length - 1}
                  onChange={(changed) => updateSteps((steps) => (steps[index] = changed))}
                  onMove={(delta) =>
                    updateSteps((steps) => {
                      const [moved] = steps.splice(index, 1)
                      if (moved) steps.splice(index + delta, 0, moved)
                    })
                  }
                  onRemove={() => updateSteps((steps) => void steps.splice(index, 1))}
                />
              ))}
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setDraft({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    emptyStep(draft.steps.at(-1)?.projectId ?? defaultProjectId)
                  ]
                })
              }
            >
              <Plus data-icon="inline-start" />
              添加步骤
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {group ? (
            <Button
              variant={confirmingDelete ? 'destructive' : 'ghost'}
              onClick={deleteGroup}
              disabled={remove.isPending}
            >
              {confirmingDelete ? '确认删除' : '删除'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
