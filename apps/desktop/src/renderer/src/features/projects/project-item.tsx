import { FolderGit2, Pin, X } from 'lucide-react'
import type { Project, Run, WorkspaceView } from '@devhub/shared'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { cn } from '@renderer/lib/utils'
import { ProjectContextMenu, ProjectMoreMenu, ProjectMoreMenuLazy } from './project-menu'
import { useProjectMenuActions } from './use-project-menu-actions'

interface ProjectItemProps {
  narrow: boolean
  project: Project
  /** The workspace that discovered the project; absent for projects added by hand. */
  workspace?: WorkspaceView
  /** Second line; relative to workspace when inside one, else full path. */
  subtitle: string
  selected: boolean
  /** Scripts and shells of this project that have not exited. */
  activeRuns: Run[]
  /** Explains what removing does, which differs inside a workspace. */
  removeTitle: string
  onSelect: () => void
  /** Asks for confirmation; the item never removes the project by itself. */
  onRemove: () => void
  onShowDetails: () => void
  onShellStarted: (run: Run) => void
  onError: (error: Error) => void
}

export function ProjectItem(props: ProjectItemProps): React.JSX.Element {
  return props.narrow ? <NarrowProjectItem {...props} /> : <DesktopProjectItem {...props} />
}

function NarrowProjectItem({
  project,
  subtitle,
  selected,
  activeRuns,
  onSelect,
  onRemove,
  onShowDetails,
  onShellStarted,
  onError
}: ProjectItemProps): React.JSX.Element {
  return (
    <li className={cn('flex items-center gap-1 rounded-lg pr-1', selected && 'bg-muted')}>
      <ProjectButton
        project={project}
        subtitle={subtitle}
        selected={selected}
        activeRuns={activeRuns}
        onChoose={onSelect}
      />
      <ProjectMoreMenuLazy
        project={project}
        onShowDetails={onShowDetails}
        onRemove={onRemove}
        onShellStarted={onShellStarted}
        onError={onError}
      />
    </li>
  )
}

function DesktopProjectItem({
  project,
  subtitle,
  selected,
  activeRuns,
  removeTitle,
  onSelect,
  onRemove,
  onShowDetails,
  onShellStarted,
  onError
}: ProjectItemProps): React.JSX.Element {
  const menu = {
    project,
    actions: useProjectMenuActions(project, { onShellStarted, onError }),
    onShowDetails,
    onRemove
  }
  const item = (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-lg pr-1 hover:bg-muted',
        selected && 'bg-muted'
      )}
    >
      <ProjectButton
        project={project}
        subtitle={subtitle}
        selected={selected}
        activeRuns={activeRuns}
        onChoose={onSelect}
      />
      <EditorButtons
        projectId={project.id}
        projectName={project.name}
        variant="icon"
        onError={onError}
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      />
      <ProjectMoreMenu {...menu} />
      {access.manage && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          title={removeTitle}
          aria-label={`移除 ${project.name}`}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X />
        </Button>
      )}
    </li>
  )
  return <ProjectContextMenu {...menu}>{item}</ProjectContextMenu>
}

function ProjectButton({
  project,
  subtitle,
  selected,
  activeRuns,
  onChoose,
  ...buttonProps
}: Pick<ProjectItemProps, 'project' | 'subtitle' | 'selected' | 'activeRuns'> & {
  onChoose: () => void
} & Omit<React.ComponentProps<'button'>, 'onSelect'>): React.JSX.Element {
  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onChoose}
      aria-current={selected ? 'true' : undefined}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{project.name}</span>
          {project.pinnedAt && (
            <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="已置顶" />
          )}
          <ActiveRunsIndicator runs={activeRuns} />
        </span>
        {subtitle !== project.name && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
    </button>
  )
}

/** Shows that a project or workspace still has live terminals (scripts or shells), and which ones. */
export function ActiveRunsIndicator({ runs }: { runs: Run[] }): React.JSX.Element | null {
  if (runs.length === 0) return null
  const stopping = runs.some((run) => run.status === 'stopping')
  return (
    <span
      role="status"
      aria-label={`${runs.length} 个活动终端`}
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
