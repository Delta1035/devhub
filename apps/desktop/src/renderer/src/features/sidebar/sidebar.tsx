import { Activity, FolderKanban, Layers3 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'

export type SidebarView = 'projects' | 'groups' | 'running'

interface SidebarProps {
  activeView: SidebarView
  activeCount: number
  onViewChange: (view: SidebarView) => void
  compact?: boolean
}

const navigationItems: { view: SidebarView; label: string; icon: typeof FolderKanban }[] = [
  { view: 'projects', label: '项目', icon: FolderKanban },
  { view: 'groups', label: '批量', icon: Layers3 },
  { view: 'running', label: '运行中', icon: Activity }
]

/** Stable feature navigation; feature-specific lists belong in the content area. */
export function Sidebar({
  activeView,
  activeCount,
  onViewChange,
  compact = true
}: SidebarProps): React.JSX.Element {
  if (compact) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
        <nav aria-label="功能导航" className="flex flex-col items-center gap-2">
          {navigationItems.map(({ view, label, icon: Icon }) => {
            const selected = activeView === view
            return (
              <Tooltip key={view}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={label}
                    aria-current={selected ? 'page' : undefined}
                    title={label}
                    onClick={() => onViewChange(view)}
                    className={cn(
                      'group relative flex size-10 cursor-pointer items-center justify-center rounded-lg transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {view === 'running' && activeCount > 0 && (
                      <span
                        role="status"
                        aria-label={`运行中 ${activeCount} 项`}
                        className={cn(
                          'absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold shadow-xs',
                          selected ? 'bg-primary-foreground text-primary' : 'bg-success text-white'
                        )}
                      >
                        {activeCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <span>
                    {label}
                    {view === 'running' && activeCount > 0 ? ` (${activeCount})` : ''}
                  </span>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>
        <div className="min-h-0 flex-1" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <nav aria-label="功能导航" className="flex flex-col gap-1">
        <p className="px-2 py-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70">
          功能
        </p>
        {navigationItems.map(({ view, label, icon: Icon }) => {
          const selected = activeView === view
          return (
            <button
              key={view}
              type="button"
              aria-label={label}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onViewChange(view)}
              className={cn(
                'group flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs transition-colors',
                selected
                  ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-4 shrink-0',
                  selected
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {view === 'running' && activeCount > 0 && (
                <span
                  role="status"
                  aria-label={`运行中 ${activeCount} 项`}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[10px] font-medium',
                    selected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-success/15 text-success'
                  )}
                >
                  {activeCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 flex-1" />
    </div>
  )
}
