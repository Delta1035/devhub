import { useState } from 'react'
import {
  Check,
  CircleDashed,
  Ellipsis,
  Layers,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  Square,
  X as XIcon
} from 'lucide-react'
import {
  activeGroups,
  sortGroups,
  type Group,
  type GroupRunState,
  type GroupStepState,
  type Project
} from '@devhub/shared'
import { access } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useProjects } from '@renderer/features/projects/use-projects'
import { useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import { GroupEditor } from './group-editor'
import {
  useGroupStates,
  useGroups,
  useSetGroupPinned,
  useStartGroup,
  useStopGroup
} from './use-groups'

interface GroupListProps {
  selectedGroupId: string | null
  onSelectGroup: (groupId: string) => void
  /** Project new groups start from. */
  selectedProjectId: string | null
  /** Jumps to a step's project when its row is clicked. */
  onSelectProject: (projectId: string) => void
}

export function GroupList({
  selectedGroupId,
  onSelectGroup,
  selectedProjectId,
  onSelectProject
}: GroupListProps): React.JSX.Element {
  const groups = useGroups()
  const states = useGroupStates()
  const projects = useProjects().data ?? []
  const runs = useRuns().data ?? []
  const start = useStartGroup()
  const stop = useStopGroup()
  const setPinned = useSetGroupPinned()
  // undefined: closed; null: creating; Group: editing.
  const [editing, setEditing] = useState<Group | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const activeIds = new Set(activeGroups(states.data ?? [], runs).map((group) => group.groupId))
  const sortedGroups = sortGroups(groups.data ?? [], activeIds)

  return (
    <section className="flex flex-col gap-3" aria-label="批量任务">
      <header className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {groups.data && `${groups.data.length} 个任务`}
        </span>
        {access.manage && (
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
            <Plus data-icon="inline-start" />
            新建
          </Button>
        )}
      </header>

      {error && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="关闭">
            <XIcon className="size-3" />
          </button>
        </p>
      )}

      {groups.data?.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          把多个项目的脚本组合起来，一键并行或按顺序启动。
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {sortedGroups.map((group) => (
          <GroupItem
            key={group.id}
            group={group}
            selected={group.id === selectedGroupId}
            onSelect={() => onSelectGroup(group.id)}
            state={states.data?.find((state) => state.groupId === group.id)}
            projects={projects}
            busy={
              (start.isPending && start.variables === group.id) ||
              (stop.isPending && stop.variables === group.id)
            }
            onStart={() => start.mutate(group.id, { onError: (e) => setError(e.message) })}
            onStop={() => stop.mutate(group.id, { onError: (e) => setError(e.message) })}
            onEdit={access.manage ? () => setEditing(group) : undefined}
            pinPending={setPinned.isPending && setPinned.variables?.groupId === group.id}
            onTogglePinned={() =>
              setPinned.mutate(
                { groupId: group.id, pinned: !group.pinnedAt },
                { onError: (e) => setError(e.message) }
              )
            }
            onSelectProject={onSelectProject}
          />
        ))}
      </ul>

      {editing !== undefined && (
        <GroupEditor
          group={editing}
          defaultProjectId={selectedProjectId ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
    </section>
  )
}

interface GroupItemProps {
  selected: boolean
  onSelect: () => void
  group: Group
  state: GroupRunState | undefined
  projects: Project[]
  busy: boolean
  onStart: () => void
  onStop: () => void
  /** Absent where groups cannot be changed (the web app). */
  onEdit?: () => void
  pinPending: boolean
  onTogglePinned: () => void
  onSelectProject: (projectId: string) => void
}

const statusLabels: Record<GroupRunState['status'], string> = {
  running: '执行中',
  done: '已完成',
  failed: '失败',
  stopped: '已停止'
}

function GroupItem({
  selected,
  onSelect,
  group,
  state,
  projects,
  busy,
  onStart,
  onStop,
  onEdit,
  pinPending,
  onTogglePinned,
  onSelectProject
}: GroupItemProps): React.JSX.Element {
  const running = state?.status === 'running'
  // Show the steps while something is happening or went wrong; finished groups stay compact.
  const showSteps = state && (state.status === 'running' || state.status === 'failed')

  return (
    <li
      className={cn('group rounded-lg px-2 py-1.5 hover:bg-muted', selected && 'bg-muted')}
      aria-label={`批量任务 ${group.name}`}
    >
      <div className="flex items-center gap-2">
        <Layers className="size-4 shrink-0 text-muted-foreground" />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onSelect}
          aria-label={`查看 ${group.name}`}
          aria-current={selected ? 'true' : undefined}
        >
          <p className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{group.name}</span>
            {group.pinnedAt && (
              <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="已置顶" />
            )}
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {group.mode === 'parallel' ? '并行' : '串行'}
            </Badge>
          </p>
          <p
            className={cn(
              'truncate text-xs text-muted-foreground',
              state?.status === 'failed' && 'text-destructive'
            )}
          >
            {state
              ? [statusLabels[state.status], state.finishedAt && formatFinished(state.finishedAt)]
                  .filter(Boolean)
                  .join(' · ')
              : `${group.steps.length} 个脚本`}
          </p>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onStart}
          disabled={busy || running}
          aria-label={`执行 ${group.name}`}
          title="执行"
        >
          {busy && !running ? <Loader2 className="animate-spin" /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onStop}
          disabled={busy}
          aria-label={`停止 ${group.name}`}
          title="停止全部（结束每个脚本的整个进程树）"
        >
          <Square />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`${group.name} 的更多操作`}
              title="更多操作"
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label={`${group.name} 的操作`}>
            <DropdownMenuItem onSelect={onTogglePinned} disabled={pinPending}>
              {group.pinnedAt ? <PinOff /> : <Pin />}
              {group.pinnedAt ? '取消置顶' : '置顶'}
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                编辑
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showSteps && (
        <ol className="mt-1 flex flex-col gap-0.5 pl-6">
          {group.steps.map((step, index) => {
            const stepState = state.steps.find((candidate) => candidate.stepId === step.id)
            const project = projects.find((candidate) => candidate.id === step.projectId)
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onSelectProject(step.projectId)}
                  className="flex w-full items-start gap-1.5 rounded px-1 text-left text-xs hover:bg-background"
                  title={stepState?.message}
                >
                  <StepIcon state={stepState?.state ?? 'pending'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {index + 1}. {project?.name ?? '（已移除的项目）'} ·{' '}
                      {step.scriptId.slice(step.scriptId.indexOf(':') + 1)}
                    </span>
                    {stepState?.message && (
                      <span
                        className={cn(
                          'block truncate text-muted-foreground',
                          stepState.state === 'failed' && 'text-destructive'
                        )}
                      >
                        {stepState.message}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}

function StepIcon({ state }: { state: GroupStepState }): React.JSX.Element {
  const className = 'mt-0.5 size-3 shrink-0'
  switch (state) {
    case 'running':
      return <Loader2 className={cn(className, 'animate-spin text-info')} aria-label="进行中" />
    case 'done':
      return <Check className={cn(className, 'text-success')} aria-label="完成" />
    case 'failed':
      return <XIcon className={cn(className, 'text-destructive')} aria-label="失败" />
    default:
      return <CircleDashed className={cn(className, 'text-muted-foreground')} aria-label="未开始" />
  }
}

/** "10:32" today, "10月1日 10:32" otherwise. */
function formatFinished(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
