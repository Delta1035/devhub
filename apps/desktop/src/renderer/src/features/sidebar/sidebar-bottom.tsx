import { ListChecks, SlidersHorizontal, Smartphone } from 'lucide-react'
import { useGroups } from '@renderer/features/groups/use-groups'
import { useRemoteState } from '@renderer/features/settings/use-remote'
import { cn } from '@renderer/lib/utils'

interface SidebarBottomProps {
  currentTab: 'projects' | 'groups'
  onSelectTab: (tab: 'projects' | 'groups') => void
  onToggleSettings?: () => void
}

export function SidebarBottom({
  currentTab,
  onSelectTab,
  onToggleSettings
}: SidebarBottomProps): React.JSX.Element {
  const { data: remote } = useRemoteState()
  const { data: groups } = useGroups()
  const groupCount = groups?.length ?? 0
  const isRemoteEnabled = remote?.enabled

  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-2">
      {/* 远程访问 */}
      <button
        type="button"
        onClick={onToggleSettings}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <Smartphone className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">远程访问</span>
        <span
          className={cn(
            'font-mono text-[10px]',
            isRemoteEnabled ? 'font-medium text-accent' : 'text-muted-foreground/70'
          )}
        >
          {isRemoteEnabled ? '已开启' : '未开启'}
        </span>
      </button>

      {/* 批量任务 */}
      <button
        type="button"
        onClick={() => onSelectTab('groups')}
        className={cn(
          'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
          currentTab === 'groups'
            ? 'bg-secondary font-medium text-foreground'
            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
        )}
      >
        <ListChecks className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">批量任务</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">{groupCount} 个</span>
      </button>

      {/* 设置 */}
      <button
        type="button"
        onClick={onToggleSettings}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
        <span className="min-w-0 flex-1 truncate text-left">设置</span>
      </button>
    </div>
  )
}
