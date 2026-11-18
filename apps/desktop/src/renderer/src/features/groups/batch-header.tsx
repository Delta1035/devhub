import { Ellipsis, Play, Plus, RotateCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useGroups, useStartGroup } from './use-groups'
import { toast } from '@renderer/lib/toast'

interface BatchHeaderProps {
  onNewGroup: () => void
}

export function BatchHeader({ onNewGroup }: BatchHeaderProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const groups = useGroups().data ?? []
  const startGroup = useStartGroup()

  const handleRefresh = (): void => {
    queryClient.invalidateQueries({ queryKey: ['groups'] }).catch(() => undefined)
    queryClient.invalidateQueries({ queryKey: ['group-states'] }).catch(() => undefined)
    toast.success('已刷新批量任务')
  }

  const handleStartAll = (): void => {
    const toStart = groups.filter((g) => g.pinnedAt)
    const targets = toStart.length > 0 ? toStart : groups.slice(0, 1)
    if (targets.length === 0) {
      toast.info('暂无可用批量任务')
      return
    }
    targets.forEach((g) => {
      startGroup.mutate(g.id)
    })
    toast.success(`已触发启动 ${targets.length} 个批量任务`)
  }

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-6 py-3.5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">批量任务</h1>
        <p className="text-xs text-muted-foreground">
          把多个项目的脚本串成一条流水线，并行或按顺序启动，失败即停止。
        </p>
      </div>

      <div className="flex items-center gap-2">
        {groups.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAll}
            disabled={startGroup.isPending}
            className="h-8 gap-1.5 border-border bg-secondary/80 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Play className="size-3.5 text-primary" />
            全部启动
          </Button>
        )}

        {access.manage && (
          <Button
            size="sm"
            onClick={onNewGroup}
            aria-label="新建"
            className="h-8 gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            新建任务
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-xs"
              className="size-8 border-border bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="批量任务操作"
              title="更多操作"
            >
              <Ellipsis className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleRefresh}>
              <RotateCw className="size-3.5" />
              刷新任务状态
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
