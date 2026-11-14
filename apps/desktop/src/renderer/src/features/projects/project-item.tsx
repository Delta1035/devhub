import { Database, FolderGit2, Globe, Pin, Server, X } from 'lucide-react'
import type { Project, Run, WorkspaceView } from '@devhub/shared'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { cn } from '@renderer/lib/utils'
import { ProjectContextMenu, ProjectMoreMenu, ProjectMoreMenuLazy } from './project-menu'
import { useProjectMenuActions } from './use-project-menu-actions'

function ProjectIcon({
  projectName,
  className
}: {
  projectName: string
  className?: string
}): React.JSX.Element {
  const name = projectName.toLowerCase()
  if (/web|ui|client|front|app|site|portal|view/.test(name)) return <Globe className={className} />
  if (/api|server|service|back|gateway|daemon/.test(name)) return <Server className={className} />
  if (/db|data|sql|cache|store|redis|postgres|mongo/.test(name))
    return <Database className={className} />
  return <FolderGit2 className={className} />
}

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
    <li
      className={cn(
        'flex items-center gap-1 rounded-lg pr-1 transition-colors',
        selected ? 'bg-secondary' : 'hover:bg-muted/50'
      )}
    >
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
        'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
        selected ? 'bg-secondary' : 'hover:bg-muted/60'
      )}
    >
      <ProjectButton
        project={project}
        subtitle={subtitle}
        selected={selected}
        activeRuns={activeRuns}
        onChoose={onSelect}
      />
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <EditorButtons
          projectId={project.id}
          projectName={project.name}
          variant="icon"
          onError={onError}
        />
        <ProjectMoreMenu {...menu} />
        {access.manage && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            title={removeTitle}
            aria-label={`移除 ${project.name}`}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
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
  const isRunning = activeRuns.length > 0

  return (
    <button
      {...buttonProps}
      type="button"
      onClick={onChoose}
      aria-current={selected ? 'true' : undefined}
      className="group/btn flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
          selected
            ? 'bg-primary/15 text-primary'
            : isRunning
              ? 'bg-success/15 text-success'
              : 'bg-muted/80 text-muted-foreground group-hover/btn:text-foreground'
        )}
      >
        <ProjectIcon projectName={project.name} className="size-3.5" />
      </div>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[13px] font-semibold',
              selected ? 'text-foreground' : 'text-foreground/90'
            )}
          >
            {project.name}
          </span>
          {project.pinnedAt && (
            <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="已置顶" />
          )}
        </span>
        {subtitle !== project.name && (
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
      <ActiveRunsIndicator runs={activeRuns} />
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
        'ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors',
        stopping ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          stopping ? 'animate-pulse bg-warning' : 'bg-success'
        )}
      />
      {runs.length === 1 ? '运行中' : runs.length}
    </span>
  )
}
