import { History, Play, Search, Settings, SquareTerminal, Terminal, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export type ProjectViewTab = 'scripts' | 'terminals' | 'history' | 'settings'

interface ProjectSubnavProps {
  currentTab: ProjectViewTab
  onTabChange: (tab: ProjectViewTab) => void
  scriptsCount: number
  activeTerminalsCount: number
  filterQuery: string
  onFilterChange: (query: string) => void
  onQuickStart?: () => void
  isStarting?: boolean
}

export function ProjectSubnav({
  currentTab,
  onTabChange,
  scriptsCount,
  activeTerminalsCount,
  filterQuery,
  onFilterChange,
  onQuickStart,
  isStarting
}: ProjectSubnavProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-background px-4 py-2 md:px-6">
      {/* 4 Tabs */}
      <nav aria-label="项目导航" className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => onTabChange('scripts')}
          aria-current={currentTab === 'scripts' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors',
            currentTab === 'scripts'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Terminal className="size-3.5" />
          <span>脚本</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.2 font-mono text-[10px]',
              currentTab === 'scripts'
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {scriptsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('terminals')}
          aria-current={currentTab === 'terminals' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors',
            currentTab === 'terminals'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <SquareTerminal className="size-3.5" />
          <span>终端</span>
          {activeTerminalsCount > 0 && (
            <span
              className={cn(
                'rounded px-1.5 py-0.2 font-mono text-[10px]',
                currentTab === 'terminals' ? 'bg-success/20 text-success' : 'bg-muted text-success'
              )}
            >
              {activeTerminalsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('history')}
          aria-current={currentTab === 'history' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors',
            currentTab === 'history'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <History className="size-3.5" />
          <span>运行历史</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('settings')}
          aria-current={currentTab === 'settings' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors',
            currentTab === 'settings'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings className="size-3.5" />
          <span>项目设置</span>
        </button>
      </nav>

      {/* Right Controls: Filter & Quick Action */}
      <div className="flex items-center gap-2">
        {currentTab === 'scripts' && (
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 size-3 text-muted-foreground" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="筛选脚本..."
              className="h-7 w-36 rounded-md border border-border/80 bg-muted/40 pl-6.5 pr-6 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-44"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => onFilterChange('')}
                className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                aria-label="清空筛选"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        {onQuickStart && (
          <Button
            size="sm"
            onClick={onQuickStart}
            disabled={isStarting}
            className="h-7 gap-1 px-2.5 text-xs font-semibold"
          >
            <Play className="size-3 fill-current" />
            全部启动
          </Button>
        )}
      </div>
    </div>
  )
}
