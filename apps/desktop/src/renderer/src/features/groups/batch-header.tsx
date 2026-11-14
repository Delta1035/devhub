import { Ellipsis, Plus, RotateCw } from 'lucide-react'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'

interface BatchHeaderProps {
  onNewGroup: () => void
}

export function BatchHeader({ onNewGroup }: BatchHeaderProps): React.JSX.Element {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-6 py-3.5">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">批量任务</h1>
        <p className="text-xs text-muted-foreground">
          把多个项目的脚本串成一条流水线，并行或按顺序启动，失败即停止。
        </p>
      </div>

      <div className="flex items-center gap-2">
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
            <DropdownMenuItem onClick={() => window.location.reload()}>
              <RotateCw className="size-3.5" />
              刷新
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
