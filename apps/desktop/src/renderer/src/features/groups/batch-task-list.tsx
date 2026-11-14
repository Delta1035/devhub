import { useState } from 'react'
import {
  Ellipsis,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plus,
  Square,
  Trash2,
  X as XIcon
} from 'lucide-react'
import { activeGroups, sortGroups, type Group } from '@devhub/shared'
import { access } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import {
  useDeleteGroup,
  useGroupStates,
  useGroups,
  useSetGroupPinned,
  useStartGroup,
  useStopGroup
} from './use-groups'
import { toast } from '@renderer/lib/toast'

interface BatchTaskListProps {
  selectedGroupId: string | null
  onSelectGroup: (groupId: string) => void
  onNewGroup: () => void
  onEditGroup: (group: Group) => void
}

export function BatchTaskList({
  selectedGroupId,
  onSelectGroup,
  onNewGroup,
  onEditGroup
}: BatchTaskListProps): React.JSX.Element {
  const groups = useGroups()
  const states = useGroupStates()
  const runs = useRuns().data ?? []
  const start = useStartGroup()
  const stop = useStopGroup()
  const setPinned = useSetGroupPinned()
  const deleteGroup = useDeleteGroup()
  const [error, setError] = useState<string | null>(null)

  const activeIds = new Set(activeGroups(states.data ?? [], runs).map((group) => group.groupId))
  const sortedGroups = sortGroups(groups.data ?? [], activeIds)

  return (
    <section
      role="region"
      aria-label="批量任务"
      className="flex h-full w-[272px] shrink-0 flex-col border-r border-border bg-card/40 p-3"
    >
      {/* 列表头部 */}
      <div className="flex shrink-0 items-center justify-between pb-2">
        <span className="text-[11px] font-semibold text-muted-foreground/70">
          任务 · {groups.data?.length ?? 0}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">最近运行</span>
          {access.manage && (
            <Button
              size="icon-xs"
              variant="ghost"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={onNewGroup}
              aria-label="新建"
              title="新建批量任务"
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 flex items-start gap-1 rounded bg-destructive/10 p-1.5 text-xs text-destructive">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="关闭">
            <XIcon className="size-3" />
          </button>
        </p>
      )}

      {/* 任务列表 */}
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {sortedGroups.map((group) => {
          const state = states.data?.find((s) => s.groupId === group.id)
          const isSelected = group.id === selectedGroupId
          const running = state?.status === 'running'
          const failed = state?.status === 'failed'
          const done = state?.status === 'done'
          const busy =
            (start.isPending && start.variables === group.id) ||
            (stop.isPending && stop.variables === group.id)
          const pinPending = setPinned.isPending && setPinned.variables?.groupId === group.id

          return (
            <li
              key={group.id}
              role="listitem"
              aria-label={`批量任务 ${group.name}`}
              className={cn(
                'group relative flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors',
                isSelected
                  ? 'border-border-strong bg-accent text-accent-foreground'
                  : 'border-transparent hover:border-border/60 hover:bg-muted/40'
              )}
            >
              <div className="flex items-center gap-2">
                {/* 状态指示点 */}
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    running && 'animate-pulse bg-primary',
                    failed && 'bg-destructive',
                    done && 'bg-muted-foreground/60',
                    !state && 'bg-muted-foreground/30'
                  )}
                />

                {/* 任务名称与点击选择 */}
                <button
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  aria-label={`查看 ${group.name}`}
                  aria-current={isSelected ? 'true' : undefined}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
                >
                  <span className="truncate text-xs font-semibold text-foreground">
                    {group.name}
                  </span>
                  {group.pinnedAt && (
                    <Pin className="size-2.5 shrink-0 text-muted-foreground" aria-label="已置顶" />
                  )}
                </button>

                {/* 状态徽标 */}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-4 shrink-0 px-1 font-mono text-[9px] font-normal border-0',
                    running && 'bg-primary/15 text-primary font-medium',
                    failed && 'bg-destructive/15 text-destructive font-medium',
                    done && 'bg-secondary text-muted-foreground',
                    !state && 'bg-secondary/60 text-muted-foreground/60'
                  )}
                >
                  {running
                    ? '运行中'
                    : failed
                      ? '失败'
                      : done
                        ? '成功'
                        : group.mode === 'parallel'
                          ? '并行'
                          : '串行'}
                </Badge>
              </div>

              {/* 第二行：步骤数、模式与时间 */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                <span>
                  {group.steps.length} 步 · {group.mode === 'parallel' ? '并行' : '串行'}
                </span>
                <span>
                  {running
                    ? '运行中'
                    : state?.finishedAt
                      ? formatFinished(state.finishedAt)
                      : '未运行'}
                </span>
              </div>

              {/* 悬停/快捷操作条 */}
              <div className="flex items-center justify-end gap-1 pt-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => start.mutate(group.id, { onError: (e) => setError(e.message) })}
                  disabled={busy || running}
                  aria-label={`执行 ${group.name}`}
                  title="执行任务"
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  {busy && !running ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Play className="size-3" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => stop.mutate(group.id, { onError: (e) => setError(e.message) })}
                  disabled={busy}
                  aria-label={`停止 ${group.name}`}
                  title="停止全部"
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  <Square className="size-3" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${group.name} 的更多操作`}
                      title="更多操作"
                      className="size-6 text-muted-foreground hover:text-foreground"
                    >
                      <Ellipsis className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" aria-label={`${group.name} 的操作`}>
                    <DropdownMenuItem
                      onSelect={() =>
                        setPinned.mutate(
                          { groupId: group.id, pinned: !group.pinnedAt },
                          {
                            onError: (e) => setError(e.message),
                            onSuccess: () =>
                              toast.success(!group.pinnedAt ? '已置顶任务' : '已取消置顶')
                          }
                        )
                      }
                      disabled={pinPending}
                    >
                      {group.pinnedAt ? (
                        <PinOff className="size-3.5" />
                      ) : (
                        <Pin className="size-3.5" />
                      )}
                      {group.pinnedAt ? '取消置顶' : '置顶'}
                    </DropdownMenuItem>
                    {access.manage && (
                      <DropdownMenuItem onSelect={() => onEditGroup(group)}>
                        <Pencil className="size-3.5" />
                        编辑步骤
                      </DropdownMenuItem>
                    )}
                    {access.manage && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          deleteGroup.mutate(group.id, {
                            onSuccess: () => toast.success(`已删除任务「${group.name}」`),
                            onError: (e) => toast.error(e.message)
                          })
                        }}
                      >
                        <Trash2 className="size-3.5" />
                        删除任务
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          )
        })}
      </ul>

      {/* 底部：从项目脚本组合新建 */}
      {access.manage && (
        <div className="mt-auto shrink-0 pt-2">
          <button
            type="button"
            onClick={onNewGroup}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-secondary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            从项目脚本组合新建
          </button>
        </div>
      )}
    </section>
  )
}

function formatFinished(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
