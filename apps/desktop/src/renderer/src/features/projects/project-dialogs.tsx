import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Project, Run, WorkspaceView } from '@devhub/shared'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { EditorButtons } from '@renderer/features/editors/editor-buttons'
import { ProjectSummary } from './project-summary'
import { useOpenProjectFolder, useRemoveProject } from './use-projects'

interface RemoveProjectDialogProps {
  project: Project
  /** Explains what removing does, which differs inside a workspace. */
  description: string
  activeRunCount: number
  onClose: () => void
}

/** Removal clears history and logs, so a stray click on the list's × must not do it alone. */
export function RemoveProjectDialog({
  project,
  description,
  activeRunCount,
  onClose
}: RemoveProjectDialogProps): React.JSX.Element {
  const remove = useRemoveProject()
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移除项目「{project.name}」？</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-xs break-all text-muted-foreground">{project.path}</p>
        {activeRunCount > 0 && (
          <p role="status" className="text-sm text-warning">
            该项目还有 {activeRunCount} 个活动终端。
          </p>
        )}
        {remove.error && (
          <p role="alert" className="text-sm text-destructive">
            {remove.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(project.id, { onSuccess: onClose })}
          >
            确认移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ProjectDetailsDialogProps {
  project: Project
  workspace?: WorkspaceView
  activeRuns: Run[]
  onClose: () => void
}

export function ProjectDetailsDialog({
  project,
  workspace,
  activeRuns,
  onClose
}: ProjectDetailsDialogProps): React.JSX.Element {
  const openFolder = useOpenProjectFolder()
  const [editorError, setEditorError] = useState<Error | null>(null)
  const error = openFolder.error ?? editorError
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>项目详情</DialogTitle>
          <DialogDescription className="sr-only">{project.name}</DialogDescription>
        </DialogHeader>
        <ProjectSummary project={project} workspace={workspace} activeRuns={activeRuns} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}
        <DialogFooter className="sm:justify-start">
          {shell && (
            <Button
              variant="outline"
              size="sm"
              disabled={openFolder.isPending}
              onClick={() => openFolder.mutate(project.id)}
            >
              <FolderOpen data-icon="inline-start" />
              打开目录
            </Button>
          )}
          <EditorButtons
            projectId={project.id}
            projectName={project.name}
            variant="labeled"
            onError={setEditorError}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
