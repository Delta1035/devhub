import { useState } from 'react'
import {
  Check,
  Copy,
  Ellipsis,
  Folder,
  FolderOpen,
  GitBranch,
  Pin,
  PinOff,
  RefreshCw,
  SquareTerminal
} from 'lucide-react'
import type { Project, Run, Script } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { useOpenInSystemTerminal } from '@renderer/features/editors/use-editors'
import { useOpenProjectFolder, useSetProjectPinned } from './use-projects'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

interface ProjectHeaderProps {
  project: Project
  activeRunsCount: number
  scripts: Script[]
  runs?: Run[]
  isFetching: boolean
  onRefresh: () => void
  onEditorError: (error: Error) => void
}

export function ProjectHeader({
  project,
  activeRunsCount,
  scripts,
  runs = [],
  isFetching,
  onRefresh,
  onEditorError
}: ProjectHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const openFolder = useOpenProjectFolder()
  const openTerminal = useOpenInSystemTerminal()
  const setPinned = useSetProjectPinned()

  const isPinned = Boolean(project.pinnedAt)

  const handleCopyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(project.path)
      setCopied(true)
      toast.success('项目路径已复制')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard write failures
    }
  }

  const handleTogglePin = (): void => {
    setPinned.mutate(
      { projectId: project.id, pinned: !isPinned },
      {
        onSuccess: () => {
          toast.success(!isPinned ? '已置顶该项目' : '已取消置顶')
        }
      }
    )
  }

  const handleRefresh = (): void => {
    onRefresh()
    toast.success('已重新扫描项目目录')
  }

  // Detect distinct package managers or runtimes from detected scripts
  const detectedSources = Array.from(
    new Set(
      scripts
        .map((s): string | null => {
          const exe = s.command.split(' ')[0]?.toLowerCase()
          if (s.source === 'go' || exe === 'go' || exe?.endsWith('go.exe')) return 'go'
          if (s.source === 'python') {
            if (exe?.includes('uv')) return 'uv'
            if (exe?.includes('poetry')) return 'poetry'
            if (exe?.includes('pdm')) return 'pdm'
            if (exe?.includes('pipenv')) return 'pipenv'
            return 'python'
          }
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

  // Calculate last run
  const projectRuns = runs.filter((r) => r.projectId === project.id)
  const latestRun = [...projectRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]

  return (
    <header className="flex flex-col gap-2 border-b border-border bg-card/40 px-4 py-3 md:px-6 md:py-3.5">
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
              isRunning ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isRunning ? 'animate-pulse bg-primary' : 'bg-muted-foreground/60'
              )}
            />
            {isRunning ? `${activeRunsCount} 个运行中` : '就绪'}
          </span>
        </div>

        <div className="flex-1" />

        {/* VS Code & IDEA Buttons */}
        <EditorButtons
          projectId={project.id}
          projectName={project.name}
          variant="labeled"
          onError={onEditorError}
        />

        {/* Pin Button */}
        <Button
          variant="outline"
          size="icon-xs"
          onClick={handleTogglePin}
          title={isPinned ? '取消置顶' : '置顶此项目'}
          aria-label={isPinned ? '取消置顶' : '置顶此项目'}
          className={cn(
            'size-8 border-border bg-secondary/80 text-muted-foreground hover:text-foreground',
            isPinned && 'text-primary border-primary/40 bg-primary/10'
          )}
        >
          {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>

        {/* 刷新 */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          title="重新扫描项目目录"
          className="h-8 gap-1.5 border-border bg-secondary/80 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          刷新
        </Button>

        {/* 更多 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-xs"
              className="size-8 border-border bg-secondary/80 text-muted-foreground hover:text-foreground"
              aria-label="更多操作"
              title="更多操作"
            >
              <Ellipsis className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                openFolder.mutate(project.id, {
                  onSuccess: () => toast.info('已请求在文件资源管理器中打开项目')
                })
              }
            >
              <FolderOpen className="size-3.5" />
              打开所在目录
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openTerminal.mutate(project.id, {
                  onSuccess: () => toast.success('已在系统终端中打开项目')
                })
              }
            >
              <SquareTerminal className="size-3.5" />
              在系统终端中打开
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyPath}>
              <Copy className="size-3.5" />
              复制完整路径
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Meta Row: Path, Tech Tags, Git Branch & Last Run */}
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
            <Check className="size-3 shrink-0 text-primary" />
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
                  className="h-4.5 px-1.5 font-mono text-[10px] text-muted-foreground border-0"
                >
                  {source}
                </Badge>
              ))}
            </div>
          </>
        )}

        <span className="h-3 w-px bg-border/80" />
        <Badge
          variant="secondary"
          className="h-4.5 gap-1 px-1.5 font-mono text-[10px] text-muted-foreground border-0"
        >
          <GitBranch className="size-2.5" />
          main
        </Badge>

        {latestRun && (
          <>
            <span className="h-3 w-px bg-border/80" />
            <span className="text-[11px] text-muted-foreground/70">
              上次运行{' '}
              {new Date(latestRun.startedAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </>
        )}
      </div>
    </header>
  )
}
