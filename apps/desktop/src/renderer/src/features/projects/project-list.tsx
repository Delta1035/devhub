import { FolderGit2, FolderPlus, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { shell } from '@renderer/api'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { useAddProject, useProjects, useRemoveProject } from './use-projects'

export function ProjectList(): React.JSX.Element {
  const projects = useProjects()
  const addProject = useAddProject()
  const removeProject = useRemoveProject()
  const error = projects.error ?? addProject.error ?? removeProject.error

  const handleAdd = async (): Promise<void> => {
    const path = await shell?.pickDirectory()
    if (path) addProject.mutate(path)
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">项目</h2>
        {shell && (
          <Button onClick={handleAdd} disabled={addProject.isPending}>
            <FolderPlus data-icon="inline-start" />
            添加项目
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
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          还没有项目。点击「添加项目」选择一个代码目录。
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {projects.data?.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            onRemove={() => removeProject.mutate(project.id)}
            removing={removeProject.isPending && removeProject.variables === project.id}
          />
        ))}
      </ul>
    </section>
  )
}

interface ProjectItemProps {
  project: Project
  onRemove: () => void
  removing: boolean
}

function ProjectItem({ project, onRemove, removing }: ProjectItemProps): React.JSX.Element {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <FolderGit2 className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{project.name}</p>
        <p className="truncate text-xs text-muted-foreground" title={project.path}>
          {project.path}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={removing}
        title="从 DevHub 移除（不会删除文件）"
        aria-label={`移除 ${project.name}`}
      >
        <X />
      </Button>
    </li>
  )
}
