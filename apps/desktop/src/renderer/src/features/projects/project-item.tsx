import { useRef, useState } from 'react'
import { FolderGit2, X } from 'lucide-react'
import type { Project, Run, WorkspaceView } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { cn } from '@renderer/lib/utils'
import { ProjectContextMenu } from './project-context-menu'
import { ProjectSummary } from './project-summary'

interface ProjectItemProps {
  project: Project
  /** The workspace that discovered the project; absent for projects added by hand. */
  workspace?: WorkspaceView
  /** Second line; the full path is in the hover card. */
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

export function ProjectItem({
  project,
  workspace,
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
  const [hoverOpen, setHoverOpen] = useState(false)
  // The pointer is still over the item while its context menu is open; the card would cover it.
  const [menuOpen, setMenuOpen] = useState(false)
  // Radix also opens the card on focus, and menus and dialogs hand focus back to the item
  // they were opened from: another item's card then popped up over the next menu or dialog.
  // The card is a hover preview (the context menu has 显示详情), so only the pointer opens it.
  const pointerOver = useRef(false)
  return (
    <ProjectContextMenu
      project={project}
      onShowDetails={onShowDetails}
      onRemove={onRemove}
      onShellStarted={onShellStarted}
      onError={onError}
      onOpenChange={(open) => {
        setMenuOpen(open)
        setHoverOpen(false)
      }}
    >
      <li
        className={cn(
          'group flex items-center gap-1 rounded-lg pr-1 hover:bg-muted',
          selected && 'bg-muted'
        )}
      >
        <HoverCard
          open={hoverOpen && !menuOpen}
          onOpenChange={(open) => setHoverOpen(open && pointerOver.current)}
          openDelay={600}
          closeDelay={100}
        >
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={onSelect}
              onPointerEnter={() => (pointerOver.current = true)}
              onPointerLeave={() => (pointerOver.current = false)}
              aria-current={selected ? 'true' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <ActiveRunsIndicator runs={activeRuns} />
                </span>
                {/* A direct child of a workspace would only repeat its name. */}
                {subtitle !== project.name && (
                  <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
                )}
              </span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-80">
            <ProjectSummary project={project} workspace={workspace} activeRuns={activeRuns} />
            <p className="mt-2 text-[11px] text-muted-foreground">右键查看更多操作</p>
          </HoverCardContent>
        </HoverCard>
        <EditorButtons
          projectId={project.id}
          projectName={project.name}
          variant="icon"
          onError={onError}
          className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
        />
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
      </li>
    </ProjectContextMenu>
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
