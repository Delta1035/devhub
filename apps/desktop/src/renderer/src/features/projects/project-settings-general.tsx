import { useState } from 'react'
import { Code2, Copy, FolderOpen, Pin, PinOff, Terminal, Trash2 } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { api, shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { useSetProjectPinned } from '@renderer/features/projects/use-projects'
import { toast } from '@renderer/lib/toast'

interface ProjectSettingsGeneralProps {
  project: Project
  onProjectRemoved?: () => void
}

export function ProjectSettingsGeneral({
  project,
  onProjectRemoved
}: ProjectSettingsGeneralProps): React.JSX.Element {
  const setPinned = useSetProjectPinned()
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const isPinned = Boolean(project.pinnedAt)

  const handleCopyPath = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(project.path)
      toast.success('项目路径已复制到剪贴板')
    } catch {
      toast.info(`路径: ${project.path}`)
    }
  }

  const handleOpenExplorer = (): void => {
    if (shell?.openProjectFolder) {
      void shell.openProjectFolder(project.id)
    }
    toast.info('已请求在文件资源管理器中打开项目')
  }

  const handleOpenEditor = (): void => {
    api
      .openInEditor(project.id, 'vscode')
      .then(() => toast.success('已在 VS Code 中打开项目'))
      .catch(() => toast.info('已尝试在默认编辑器中打开项目'))
  }

  const handleOpenTerminal = (): void => {
    api
      .openInSystemTerminal(project.id)
      .then(() => toast.success('已在外部终端打开项目'))
      .catch(() => toast.info('已尝试在系统终端中打开项目'))
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

  const handleRemoveProject = async (): Promise<void> => {
    setIsRemoving(true)
    try {
      await api.removeProject(project.id)
      toast.success('已从 DevHub 中移除项目')
      setRemoveDialogOpen(false)
      onProjectRemoved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '移除失败')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <section className="space-y-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">基本信息</h4>
        <div className="divide-y divide-border rounded-lg border border-border bg-card/60">
          <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-foreground">项目名称</span>
            <span className="font-mono text-xs text-foreground/90">{project.name}</span>
          </div>

          <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">项目路径</span>
              <span className="font-mono text-[11px] text-muted-foreground break-all">
                {project.path}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCopyPath()}
                className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-3" />
                复制路径
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExplorer}
                className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <FolderOpen className="size-3" />
                打开目录
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-foreground">添加方式</span>
            <span className="text-xs text-muted-foreground">
              {project.workspaceId ? '工作区自动扫描发现' : '手动导入'}
            </span>
          </div>

          <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-foreground">添加时间</span>
            <span className="font-mono text-xs text-muted-foreground">
              {new Date(project.addedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      {/* Quick Launch & Actions */}
      <section className="space-y-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">快捷操作</h4>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Button
            variant="outline"
            onClick={handleOpenEditor}
            className="h-auto flex-col items-start gap-1 p-3 border-border bg-card/60 hover:bg-secondary/60 text-left"
          >
            <div className="flex items-center gap-2 font-medium text-xs text-foreground">
              <Code2 className="size-3.5 text-primary" />在 VS Code 中打开
            </div>
            <span className="text-[11px] text-muted-foreground">
              唤起外部编辑器打开当前源码仓库
            </span>
          </Button>

          <Button
            variant="outline"
            onClick={handleOpenTerminal}
            className="h-auto flex-col items-start gap-1 p-3 border-border bg-card/60 hover:bg-secondary/60 text-left"
          >
            <div className="flex items-center gap-2 font-medium text-xs text-foreground">
              <Terminal className="size-3.5 text-primary" />
              在外部终端中打开
            </div>
            <span className="text-[11px] text-muted-foreground">在当前目录启动系统原生控制台</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleTogglePin}
            className="h-auto flex-col items-start gap-1 p-3 border-border bg-card/60 hover:bg-secondary/60 text-left"
          >
            <div className="flex items-center gap-2 font-medium text-xs text-foreground">
              {isPinned ? (
                <PinOff className="size-3.5 text-warning" />
              ) : (
                <Pin className="size-3.5 text-primary" />
              )}
              {isPinned ? '取消置顶项目' : '置顶当前项目'}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isPinned ? '已在左侧栏置顶排头展示' : '置顶后将在侧栏固定靠前'}
            </span>
          </Button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-3 pt-2">
        <h4 className="font-heading text-sm font-semibold text-destructive">危险区域</h4>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-destructive">从 DevHub 移除项目</span>
            <span className="text-[11px] text-muted-foreground">
              仅解除 DevHub 托管，不会删除磁盘上的任何源码与文件。
            </span>
          </div>

          <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-8 gap-1.5 shrink-0 text-xs">
                <Trash2 className="size-3.5" />
                移除项目
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card text-foreground max-w-sm">
              <DialogHeader>
                <DialogTitle>确认移除项目？</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  确定要从 DevHub 中移除「{project.name}」吗？本地磁盘文件不会受任何影响。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoveDialogOpen(false)}
                  disabled={isRemoving}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleRemoveProject()}
                  disabled={isRemoving}
                >
                  {isRemoving ? '正在移除...' : '确认移除'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  )
}
