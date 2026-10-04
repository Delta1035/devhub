import { ChevronRight, FolderTree, RefreshCw, Settings2, TriangleAlert } from 'lucide-react'
import type { WorkspaceView } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface WorkspaceSectionProps {
  workspace: WorkspaceView
  projectCount: number
  collapsed: boolean
  rescanning: boolean
  onToggle: () => void
  onRescan: () => void
  onOpenSettings: () => void
  /** The project items, rendered while expanded. */
  children: React.ReactNode
}

export function WorkspaceSection({
  workspace,
  projectCount,
  collapsed,
  rescanning,
  onToggle,
  onRescan,
  onOpenSettings,
  children
}: WorkspaceSectionProps): React.JSX.Element {
  const warnings = workspace.scan?.warnings ?? []
  return (
    <section aria-label={`工作区 ${workspace.name}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={workspace.path}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn('size-3.5 shrink-0 transition-transform', !collapsed && 'rotate-90')}
          />
          <FolderTree className="size-3.5 shrink-0" />
          <span className="truncate">{workspace.name}</span>
          <span className="tabular-nums">{projectCount}</span>
        </button>
        {warnings.length > 0 && (
          <span
            role="img"
            aria-label="扫描警告"
            title={warnings.join('\n')}
            className="flex shrink-0 text-warning"
          >
            <TriangleAlert className="size-3.5" />
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRescan}
          disabled={rescanning}
          title="重新扫描工作区"
          aria-label={`重新扫描 ${workspace.name}`}
        >
          <RefreshCw className={cn(rescanning && 'animate-spin')} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onOpenSettings}
          title="工作区设置：扫描层数、已排除的项目、移除"
          aria-label={`${workspace.name} 工作区设置`}
        >
          <Settings2 />
        </Button>
      </div>
      {!collapsed &&
        (projectCount > 0 ? (
          <ul className="flex flex-col gap-1 pl-2">{children}</ul>
        ) : (
          <p className="px-2 py-1 pl-7 text-xs text-muted-foreground">
            {workspace.scan && !workspace.scan.available ? '无法扫描该目录' : '未发现项目'}
          </p>
        ))}
    </section>
  )
}
