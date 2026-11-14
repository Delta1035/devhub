import {
  History,
  Play,
  Search,
  Settings,
  SquareTerminal,
  Terminal,
  Workflow,
  X
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export type ProjectViewTab = 'scripts' | 'terminals' | 'history' | 'tasks' | 'settings'

interface ProjectSubnavProps {
  currentTab: ProjectViewTab
  onTabChange: (tab: ProjectViewTab) => void
  scriptsCount: number
  historyCount?: number
  activeTerminalsCount: number
  tasksCount?: number
  filterQuery: string
  onFilterChange: (query: string) => void
  onQuickStart?: () => void
  isStarting?: boolean
}

export function ProjectSubnav({
  currentTab,
  onTabChange,
  scriptsCount,
  historyCount = 0,
  activeTerminalsCount,
  tasksCount = 0,
  filterQuery,
  onFilterChange,
  onQuickStart,
  isStarting
}: ProjectSubnavProps): React.JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/20 px-4 py-2 md:px-6">
      {/* 5 Tabs aligned with pen/devhub.pen */}
      <nav aria-label="项目导航" className="flex items-center gap-1 sm:gap-2">
        {/* 脚本 */}
        <button
          type="button"
          onClick={() => onTabChange('scripts')}
          aria-label={scriptsCount > 0 ? `脚本 (${scriptsCount} 个)` : '脚本'}
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
                ? 'bg-primary/15 text-primary font-semibold'
                : 'bg-secondary text-muted-foreground'
            )}
          >
            {scriptsCount}
          </span>
        </button>

        {/* 运行历史 */}
        <button
          type="button"
          onClick={() => onTabChange('history')}
          aria-label={historyCount > 0 ? `运行历史 (${historyCount} 项)` : '运行历史'}
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
          {historyCount > 0 && (
            <span
              className={cn(
                'rounded px-1.5 py-0.2 font-mono text-[10px]',
                currentTab === 'history'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {historyCount}
            </span>
          )}
        </button>

        {/* 终端 */}
        <button
          type="button"
          onClick={() => onTabChange('terminals')}
          aria-label={activeTerminalsCount > 0 ? `终端 (${activeTerminalsCount} 个)` : '终端'}
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
                currentTab === 'terminals'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {activeTerminalsCount}
            </span>
          )}
        </button>

        {/* 任务 */}
        <button
          type="button"
          onClick={() => onTabChange('tasks')}
          aria-label={tasksCount > 0 ? `任务 (${tasksCount} 个)` : '任务'}
          aria-current={currentTab === 'tasks' ? 'page' : undefined}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors',
            currentTab === 'tasks'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Workflow className="size-3.5" />
          <span>任务</span>
          {tasksCount > 0 && (
            <span
              className={cn(
                'rounded px-1.5 py-0.2 font-mono text-[10px]',
                currentTab === 'tasks'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              {tasksCount}
            </span>
          )}
        </button>

        {/* 项目设置 */}
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
              className="h-7 w-36 rounded-md border border-border bg-secondary/60 pl-6.5 pr-6 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring sm:w-44"
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
            className="h-7 gap-1 bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Play className="size-3 fill-current" />
            全部启动
          </Button>
        )}
      </div>
    </div>
  )
}
