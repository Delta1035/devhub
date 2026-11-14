import { useState } from 'react'
import { Check, Copy, Folder, RefreshCw } from 'lucide-react'
import type { Project, Script } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { cn } from '@renderer/lib/utils'

interface ProjectHeaderProps {
  project: Project
  activeRunsCount: number
  scripts: Script[]
  isFetching: boolean
  onRefresh: () => void
  onEditorError: (error: Error) => void
}

export function ProjectHeader({
  project,
  activeRunsCount,
  scripts,
  isFetching,
  onRefresh,
  onEditorError
}: ProjectHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(project.path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard write failures
    }
  }

  // Detect distinct package managers or runtimes from detected scripts
  const detectedSources = Array.from(
    new Set(
      scripts
        .map((s): string | null => {
          const exe = s.command.split(' ')[0]?.toLowerCase()
          if (exe?.includes('pnpm')) return 'pnpm'
          if (exe?.includes('yarn')) return 'yarn'
          if (exe?.includes('npm')) return 'npm'
          if (exe?.includes('bun')) return 'bun'
          if (exe?.includes('mvn')) return 'maven'
          if (exe?.includes('gradle')) return 'gradle'
          return null
        })
        .filter((s): s is string => s !== null)
    )
  )

  const isRunning = activeRunsCount > 0

  return (
    <header className="flex flex-col gap-2.5 border-b border-border/80 bg-background px-4 py-3 md:px-6 md:py-4">
      {/* Title Row */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate font-heading text-lg font-semibold text-foreground md:text-xl">
            {project.name}
          </h2>
          <span
            role="status"
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              isRunning ? 'bg-success/15 text-success' : 'bg-muted/80 text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isRunning ? 'animate-pulse bg-success' : 'bg-muted-foreground/60'
              )}
            />
            {isRunning ? `${activeRunsCount} 个运行中` : '就绪'}
          </span>
        </div>

        <div className="flex-1" />

        <EditorButtons
          projectId={project.id}
          projectName={project.name}
          variant="labeled"
          onError={onEditorError}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          title="重新扫描项目目录"
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* Meta Row: Path & Tech Tags */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleCopyPath}
          title="点击复制项目绝对路径"
          className="group/path flex max-w-md items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground"
        >
          <Folder className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{project.path}</span>
          {copied ? (
            <Check className="size-3 shrink-0 text-success" />
          ) : (
            <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover/path:opacity-100" />
          )}
        </button>

        {detectedSources.length > 0 && (
          <>
            <span className="h-3 w-px bg-border/80" />
            <div className="flex items-center gap-1">
              {detectedSources.map((source) => (
                <Badge
                  key={source}
                  variant="secondary"
                  className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
                >
                  {source}
                </Badge>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
