import { useState } from 'react'
import { workspaceDepthMax, workspaceDepthMin, type WorkspaceView } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useRemoveWorkspace, useUpdateWorkspace } from './use-workspaces'
import { relativeToWorkspace } from './workspace-display'

const depths = Array.from(
  { length: workspaceDepthMax - workspaceDepthMin + 1 },
  (_, index) => workspaceDepthMin + index
)

interface WorkspaceSettingsDialogProps {
  workspace: WorkspaceView
  projectCount: number
  onClose: () => void
}

/** Every change applies immediately and rescans; removal asks for a second click. */
export function WorkspaceSettingsDialog({
  workspace,
  projectCount,
  onClose
}: WorkspaceSettingsDialogProps): React.JSX.Element {
  const update = useUpdateWorkspace()
  const remove = useRemoveWorkspace()
  const [confirming, setConfirming] = useState(false)
  const error = update.error ?? remove.error
  const warnings = workspace.scan?.warnings ?? []

  const restore = (path: string): void =>
    update.mutate({
      workspaceId: workspace.id,
      patch: { excluded: workspace.excluded.filter((entry) => entry !== path) }
    })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>工作区：{workspace.name}</DialogTitle>
          <DialogDescription className="break-all">{workspace.path}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 text-sm">
          <label className="flex items-center justify-between gap-4">
            <span>
              扫描层数
              <span className="block text-xs text-muted-foreground">
                1 层只查找直接子目录；找到项目后不再查找它的内部
              </span>
            </span>
            <select
              aria-label="扫描层数"
              value={workspace.depth}
              disabled={update.isPending}
              onChange={(event) =>
                update.mutate({
                  workspaceId: workspace.id,
                  patch: { depth: Number(event.target.value) }
                })
              }
              className="h-8 shrink-0 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {depths.map((depth) => (
                <option key={depth} value={depth}>
                  {depth} 层
                </option>
              ))}
            </select>
          </label>

          {warnings.length > 0 && (
            <div role="status" className="flex flex-col gap-1 text-xs text-warning">
              <span className="font-medium">上次扫描的警告</span>
              {warnings.map((warning) => (
                <span key={warning} className="break-all">
                  {warning}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span>已排除的项目</span>
            {workspace.excluded.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                没有排除的项目。在侧栏移除工作区中的项目后，它会出现在这里，可随时恢复。
              </p>
            ) : (
              <ul aria-label="已排除的项目" className="flex flex-col gap-1">
                {workspace.excluded.map((path) => (
                  <li key={path} className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs" title={path}>
                      {relativeToWorkspace(path, workspace)}
                    </span>
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={update.isPending}
                      onClick={() => restore(path)}
                      aria-label={`恢复 ${relativeToWorkspace(path, workspace)}`}
                    >
                      恢复
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p role="alert" className="text-destructive">
              {error.message}
            </p>
          )}
        </div>

        <DialogFooter className="items-center">
          {confirming ? (
            <>
              <span className="mr-auto text-xs text-muted-foreground">
                将同时移除其中的 {projectCount} 个项目及其运行历史（不会删除文件）
              </span>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(workspace.id, { onSuccess: onClose })}
              >
                确认移除
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              移除工作区
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
