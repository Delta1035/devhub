import { useState } from 'react'
import { RefreshCw, TriangleAlert, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { ScriptList } from '@renderer/features/scripts/script-list'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { TerminalPanel } from '@renderer/features/terminal/terminal-panel'
import { cn } from '@renderer/lib/utils'

export function ProjectDetail({ project }: { project: Project }): React.JSX.Element {
  const scripts = useProjectScripts(project.id)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<Error | null>(null)
  const [terminalMaximized, setTerminalMaximized] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-lg font-semibold">{project.name}</h2>
          <p className="truncate text-xs text-muted-foreground" title={project.path}>
            {project.path}
          </p>
        </div>
        <EditorButtons
          projectId={project.id}
          projectName={project.name}
          variant="labeled"
          onError={setEditorError}
        />
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
      <div
        className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-4', terminalMaximized && 'hidden')}
      >
        {editorError && (
          <Alert variant="destructive" className="mb-4">
            <TriangleAlert />
            <AlertTitle>无法打开编辑器</AlertTitle>
            <AlertDescription>{editorError.message}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setEditorError(null)}
                aria-label="关闭"
              >
                <X />
              </Button>
            </AlertAction>
          </Alert>
        )}
        <ScriptList project={project} onRunStarted={(run) => setActiveRunId(run.id)} />
      </div>
      <TerminalPanel
        projectId={project.id}
        activeRunId={activeRunId}
        onActiveRunChange={setActiveRunId}
        maximized={terminalMaximized}
        onToggleMaximized={() => setTerminalMaximized(!terminalMaximized)}
      />
    </div>
  )
}
