import { Activity, FolderKanban, Layers3 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export type SidebarView = 'projects' | 'groups' | 'running'

interface SidebarProps {
  activeView: SidebarView
  activeCount: number
  onViewChange: (view: SidebarView) => void
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
  onViewChange
}: SidebarProps): React.JSX.Element {
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
