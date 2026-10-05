import { useState } from 'react'
import { ChevronDown, FolderPlus, FolderTree } from 'lucide-react'
import type { Project, Run, WorkspaceView } from '@devhub/shared'
import { access, shell } from '@renderer/api'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useRuns } from '@renderer/features/runs/use-runs'
import {
  useAddWorkspace,
  useRescanWorkspaces,
  useWorkspaces
} from '@renderer/features/workspaces/use-workspaces'
import {
  relativeToWorkspace,
  useCollapsedWorkspaces
} from '@renderer/features/workspaces/workspace-display'
import { WorkspaceSection } from '@renderer/features/workspaces/workspace-section'
import { WorkspaceSettingsDialog } from '@renderer/features/workspaces/workspace-settings-dialog'
import { ProjectDetailsDialog, RemoveProjectDialog } from './project-dialogs'
import { ProjectItem } from './project-item'
import { useAddProject, useProjects } from './use-projects'

const removeStandaloneTitle = '从 DevHub 移除，并清理运行历史与历史日志（不会删除项目文件）'
const removeFromWorkspaceTitle =
  '从 DevHub 移除并在此工作区中排除（可在工作区设置中恢复），同时清理运行历史与历史日志（不会删除项目文件）'

interface ProjectDialog {
  kind: 'remove' | 'details'
  projectId: string
}

interface ProjectListProps {
  selectedId: string | null
  onSelect: (projectId: string) => void
  /** Shows a run's terminal tab in its project (after opening a shell from the context menu). */
  onOpenRun: (run: Run) => void
}

export function ProjectList({
  selectedId,
  onSelect,
  onOpenRun
}: ProjectListProps): React.JSX.Element {
  const projects = useProjects()
  const workspaces = useWorkspaces()
  // Pushed by run events, so the indicators follow starts and exits without polling.
  const activeRuns = (useRuns().data ?? []).filter((run) => run.status !== 'exited')
  const addProject = useAddProject()
  const addWorkspace = useAddWorkspace()
  const rescan = useRescanWorkspaces()
  const [collapsed, toggleCollapsed] = useCollapsedWorkspaces()
  const [settingsId, setSettingsId] = useState<string | null>(null)
  // Dialogs are opened from an item (× button or context menu) but live here, once per list.
  const [dialog, setDialog] = useState<ProjectDialog | null>(null)
  const [actionError, setActionError] = useState<Error | null>(null)
  const error =
    projects.error ??
    workspaces.error ??
    addProject.error ??
    addWorkspace.error ??
    rescan.error ??
    actionError

  const allProjects = projects.data ?? []
  const workspaceList = workspaces.data ?? []
  const known = new Set(workspaceList.map((workspace) => workspace.id))
  // Sorted like a file tree: projects found by a later scan would otherwise trail at the end.
  const projectsOf = (workspace: WorkspaceView): Project[] =>
    allProjects
      .filter((project) => project.workspaceId === workspace.id)
      .sort((a, b) =>
        relativeToWorkspace(a.path, workspace).localeCompare(relativeToWorkspace(b.path, workspace))
      )
  // Added by hand, or discovered by a workspace this list has not loaded yet.
  const standalone = allProjects.filter(
    (project) => !project.workspaceId || !known.has(project.workspaceId)
  )
  const settingsWorkspace = workspaceList.find((workspace) => workspace.id === settingsId)

  const handleAddProject = async (): Promise<void> => {
    const path = await shell?.pickDirectory()
    if (path) addProject.mutate(path, { onSuccess: (project) => onSelect(project.id) })
  }
  const handleAddWorkspace = async (): Promise<void> => {
    const path = await shell?.pickDirectory()
    if (path) addWorkspace.mutate(path)
  }

  const runsOf = (projectId: string): Run[] =>
    activeRuns.filter((run) => run.projectId === projectId)
  // Looked up again on render, so a dialog follows renames and closes once the project is gone.
  const dialogProject = allProjects.find((project) => project.id === dialog?.projectId)
  const dialogWorkspace = workspaceList.find(
    (workspace) => workspace.id === dialogProject?.workspaceId
  )

  const renderItem = (project: Project, workspace?: WorkspaceView): React.JSX.Element => (
    <ProjectItem
      key={project.id}
      project={project}
      workspace={workspace}
      subtitle={workspace ? relativeToWorkspace(project.path, workspace) : project.path}
      selected={project.id === selectedId}
      activeRuns={runsOf(project.id)}
      removeTitle={workspace ? removeFromWorkspaceTitle : removeStandaloneTitle}
      onSelect={() => onSelect(project.id)}
      onRemove={() => setDialog({ kind: 'remove', projectId: project.id })}
      onShowDetails={() => setDialog({ kind: 'details', projectId: project.id })}
      onShellStarted={onOpenRun}
      onError={setActionError}
    />
  )

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {projects.data && `${projects.data.length} 个项目`}
        </span>
        {shell && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={addProject.isPending || addWorkspace.isPending}>
                <FolderPlus data-icon="inline-start" />
                添加
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem onSelect={handleAddProject}>
                <FolderPlus />
                <span className="flex flex-col">
                  添加项目
                  <span className="text-xs text-muted-foreground">选择一个代码目录</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleAddWorkspace}>
                <FolderTree />
                <span className="flex flex-col">
                  添加工作区
                  <span className="text-xs text-muted-foreground">
                    自动发现目录中的项目并保持同步
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {projects.data?.length === 0 && workspaceList.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          {shell
            ? '还没有项目。点击「添加」选择一个代码目录，或添加工作区自动发现其中的项目。'
            : '还没有项目。项目需要在电脑上的 DevHub 中添加。'}
        </p>
      )}

      {workspaceList.map((workspace) => {
        const members = projectsOf(workspace)
        return (
          <WorkspaceSection
            key={workspace.id}
            workspace={workspace}
            projectCount={members.length}
            collapsed={collapsed.has(workspace.id)}
            rescanning={rescan.isPending}
            onToggle={() => toggleCollapsed(workspace.id)}
            onRescan={() => rescan.mutate()}
            onOpenSettings={access.manage ? () => setSettingsId(workspace.id) : undefined}
          >
            {members.map((project) => renderItem(project, workspace))}
          </WorkspaceSection>
        )
      })}

      {standalone.length > 0 && (
        <section aria-label="独立项目" className="flex flex-col gap-1">
          {workspaceList.length > 0 && (
            <h3 className="px-1 py-1 text-xs font-medium text-muted-foreground">独立项目</h3>
          )}
          <ul className="flex flex-col gap-1">
            {standalone.map((project) => renderItem(project))}
          </ul>
        </section>
      )}

      {settingsWorkspace && (
        <WorkspaceSettingsDialog
          workspace={settingsWorkspace}
          projectCount={projectsOf(settingsWorkspace).length}
          onClose={() => setSettingsId(null)}
        />
      )}

      {dialog?.kind === 'remove' && dialogProject && (
        <RemoveProjectDialog
          project={dialogProject}
          description={dialogWorkspace ? removeFromWorkspaceTitle : removeStandaloneTitle}
          activeRunCount={runsOf(dialogProject.id).length}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'details' && dialogProject && (
        <ProjectDetailsDialog
          project={dialogProject}
          workspace={dialogWorkspace}
          activeRuns={runsOf(dialogProject.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}
