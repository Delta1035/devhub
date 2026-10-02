import { useState } from 'react'
import { FolderGit2, FolderPlus, X } from 'lucide-react'
import type { Project, Run } from '@devhub/shared'
import { shell } from '@renderer/api'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { useRuns } from '@renderer/features/runs/use-runs'
import { cn } from '@renderer/lib/utils'
import { useAddProject, useProjects, useRemoveProject } from './use-projects'

interface ProjectListProps {
  selectedId: string | null
  onSelect: (projectId: string) => void
}

export function ProjectList({ selectedId, onSelect }: ProjectListProps): React.JSX.Element {
  const projects = useProjects()
  // Pushed by run events, so the indicators follow starts and exits without polling.
  const activeRuns = (useRuns().data ?? []).filter((run) => run.status !== 'exited')
  const addProject = useAddProject()
  const removeProject = useRemoveProject()
  const [editorError, setEditorError] = useState<Error | null>(null)
  const error = projects.error ?? addProject.error ?? removeProject.error ?? editorError

  const handleAdd = async (): Promise<void> => {
    const path = await shell?.pickDirectory()
    if (path) addProject.mutate(path, { onSuccess: (project) => onSelect(project.id) })
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {projects.data && `${projects.data.length} 个项目`}
        </span>
        {shell && (
          <Button size="sm" onClick={handleAdd} disabled={addProject.isPending}>
            <FolderPlus data-icon="inline-start" />
            添加
          </Button>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {projects.data?.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          还没有项目。点击「添加」选择一个代码目录。
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {projects.data?.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            selected={project.id === selectedId}
            activeRuns={activeRuns.filter((run) => run.projectId === project.id)}
            onSelect={() => onSelect(project.id)}
            onRemove={() => removeProject.mutate(project.id)}
            onEditorError={setEditorError}
            removing={removeProject.isPending && removeProject.variables === project.id}
          />
        ))}
      </ul>
    </section>
  )
}

interface ProjectItemProps {
  project: Project
  selected: boolean
  /** Scripts and shells of this project that have not exited. */
  activeRuns: Run[]
  onSelect: () => void
  onRemove: () => void
  onEditorError: (error: Error) => void
  removing: boolean
}

function ProjectItem({
  project,
  selected,
  activeRuns,
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
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{project.name}</span>
            <ActiveRunsIndicator runs={activeRuns} />
          </span>
          <span className="block truncate text-xs text-muted-foreground" title={project.path}>
            {project.path}
          </span>
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
        title="从 DevHub 移除（不会删除文件）"
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
        stopping ? 'text-amber-600' : 'text-emerald-600'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          stopping ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'
        )}
      />
      {runs.length}
    </span>
  )
}
