import { RefreshCw } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { ScriptList } from '@renderer/features/scripts/script-list'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { TerminalPanel } from '@renderer/features/terminal/terminal-panel'

export function ProjectDetail({ project }: { project: Project }): React.JSX.Element {
  const scripts = useProjectScripts(project.id)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-semibold">{project.name}</h2>
          <p className="truncate text-xs text-muted-foreground" title={project.path}>
            {project.path}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void scripts.refetch()}
          disabled={scripts.isFetching}
          title="重新扫描项目目录"
        >
          <RefreshCw
            data-icon="inline-start"
            className={scripts.isFetching ? 'animate-spin' : ''}
          />
          刷新
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <ScriptList project={project} />
      </div>
      <TerminalPanel />
    </div>
  )
}
