import { useState } from 'react'
import { Ellipsis, Pencil, Pin, PinOff, Plus, Trash2, X as XIcon } from 'lucide-react'
import { activeGroups, sortGroups, type Group, type GroupSortOrder } from '@devhub/shared'
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
import { resolveGroupStatus } from './group-status'
import { GROUP_SORT_STORAGE_KEY, getStoredGroupSortOrder } from './group-sort'
import { GroupSortMenu } from './group-sort-menu'
import { useDeleteGroup, useGroupStates, useGroups, useSetGroupPinned } from './use-groups'
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
  const setPinned = useSetGroupPinned()
  const deleteGroup = useDeleteGroup()
  const [error, setError] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<GroupSortOrder>(getStoredGroupSortOrder)

  const handleSortOrderChange = (order: GroupSortOrder): void => {
    setSortOrder(order)
    try {
      localStorage.setItem(GROUP_SORT_STORAGE_KEY, order)
    } catch {
      // ignore
    }
  }

  const activeList = activeGroups(states.data ?? [], runs)
  const activeIds = new Set(activeList.map((group) => group.groupId))
  const sortedGroups = sortGroups(groups.data ?? [], activeIds, {
    order: sortOrder,
    states: states.data
  })

  return (
    <section
      role="region"
      aria-label="批量任务"
      className="flex h-full max-h-52 min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card/40 p-3 md:max-h-none md:w-[272px] md:border-b-0 md:border-r"
    >
      {/* 列表头部 */}
      <div className="flex shrink-0 items-center justify-between pb-2">
        <span className="text-[11px] font-semibold text-muted-foreground/70">
          任务 · {groups.data?.length ?? 0}
        </span>
        <div className="flex items-center gap-1.5">
          <GroupSortMenu sortOrder={sortOrder} onSortOrderChange={handleSortOrderChange} />
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
          const active = activeList.find((a) => a.groupId === group.id)
          const presentation = resolveGroupStatus({ group, state, active })
          const isSelected = group.id === selectedGroupId
          const pinPending = setPinned.isPending && setPinned.variables?.groupId === group.id

          return (
            <li
              key={group.id}
              role="listitem"
              aria-label={`批量任务 ${group.name}`}
              className={cn(
                'group relative rounded-lg border transition-colors',
                isSelected
                  ? 'border-primary/40 bg-primary/10 text-foreground shadow-xs before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary'
                  : 'border-transparent hover:border-border/60 hover:bg-muted/50'
              )}
            >
              {/* 整卡直接点击选中 */}
              <button
                type="button"
                onClick={() => onSelectGroup(group.id)}
                aria-label={`查看 ${group.name}`}
                aria-current={isSelected ? 'true' : undefined}
                className="flex w-full cursor-pointer flex-col gap-1.5 rounded-lg p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex w-full items-center gap-2 pr-7">
                  {/* 状态指示点 */}
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      presentation.dotState === 'starting' && 'animate-pulse bg-primary',
                      presentation.dotState === 'running' && 'bg-primary',
                      presentation.dotState === 'failed' && 'bg-destructive',
                      presentation.dotState === 'done' && 'bg-muted-foreground/60',
                      presentation.dotState === 'idle' && 'bg-muted-foreground/30'
                    )}
                  />

                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {group.name}
                    </span>
                    {group.pinnedAt && (
                      <Pin
                        className="size-2.5 shrink-0 text-muted-foreground"
                        aria-label="已置顶"
                      />
                    )}
                  </span>

                  {/* 状态徽标 */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      'h-4 shrink-0 border-0 px-1 font-mono text-[9px] font-normal',
                      presentation.isActive && 'bg-primary/15 font-medium text-primary',
                      presentation.phase === 'failed' &&
                        'bg-destructive/15 font-medium text-destructive',
                      (presentation.phase === 'done' || presentation.phase === 'stopped') &&
                        'bg-secondary text-muted-foreground',
                      presentation.phase === 'idle' && 'bg-secondary/60 text-muted-foreground/60'
                    )}
                  >
                    {presentation.badgeText}
                  </Badge>
                </div>

                {/* 第二行：步骤数、模式与时间 */}
                <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground/70">
                  <span>
                    {group.steps.length} 步 · {group.mode === 'parallel' ? '并行' : '串行'}
                  </span>
                  <span className={cn(presentation.phase === 'failed' && 'text-destructive')}>
                    {presentation.summaryText}
                  </span>
                </div>
              </button>

              <div className="absolute top-2 right-2 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${group.name} 的更多操作`}
                      title="更多操作"
                      className="size-6 text-muted-foreground/70 hover:text-foreground"
                    >
                      <Ellipsis className="size-3.5" />
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
