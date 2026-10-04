import { FolderGit2, X } from 'lucide-react'
import type { Project, Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { cn } from '@renderer/lib/utils'

interface ProjectItemProps {
  project: Project
  /** Second line; the full path stays in its tooltip. */
  subtitle: string
  selected: boolean
  /** Scripts and shells of this project that have not exited. */
  activeRuns: Run[]
  /** Explains what removing does, which differs inside a workspace. */
  removeTitle: string
  onSelect: () => void
  onRemove: () => void
  onEditorError: (error: Error) => void
  removing: boolean
}

export function ProjectItem({
  project,
  subtitle,
  selected,
  activeRuns,
  removeTitle,
  onSelect,
  onRemove,
  onEditorError,
  removing
}: ProjectItemProps): React.JSX.Element {
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-1 hover:bg-muted',
        selected && 'bg-muted'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0" title={project.path}>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{project.name}</span>
            <ActiveRunsIndicator runs={activeRuns} />
          </span>
          {/* A direct child of a workspace would only repeat its name. */}
          {subtitle !== project.name && (
            <span className="block truncate text-xs text-muted-foreground" title={project.path}>
              {subtitle}
            </span>
          )}
        </span>
      </button>
      <EditorButtons
        projectId={project.id}
        projectName={project.name}
        variant="icon"
        onError={onEditorError}
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        disabled={removing}
        title={removeTitle}
        aria-label={`移除 ${project.name}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X />
      </Button>
    </li>
  )
}

/** Shows that a project still has live terminals (scripts or shells), and which ones. */
function ActiveRunsIndicator({ runs }: { runs: Run[] }): React.JSX.Element | null {
  if (runs.length === 0) return null
  const stopping = runs.some((run) => run.status === 'stopping')
  return (
    <span
      role="status"
      aria-label={`${runs.length} 个活动终端`}
      title={`运行中：${runs.map((run) => run.title).join('、')}`}
      className={cn(
        'flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums',
        stopping ? 'text-warning' : 'text-success'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          stopping ? 'animate-pulse bg-warning' : 'bg-success'
        )}
      />
      {runs.length}
    </span>
  )
}
