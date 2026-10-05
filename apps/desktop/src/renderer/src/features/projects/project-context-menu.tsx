import { AppWindow, Copy, FolderOpen, Info, SquareTerminal, X } from 'lucide-react'
import type { Project, Run } from '@devhub/shared'
import { access, shell } from '@renderer/api'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  useEditors,
  useOpenInEditor,
  useOpenInSystemTerminal,
  useSystemTerminal
} from '@renderer/features/editors/use-editors'
import { useStartShell } from '@renderer/features/terminal/use-shells'
import { useOpenProjectFolder } from './use-projects'

interface ProjectContextMenuProps {
  project: Project
  onShowDetails: () => void
  /** Opens the confirmation; nothing is removed from the menu directly. */
  onRemove: () => void
  /** Called with the interactive shell just opened, so its terminal tab can be shown. */
  onShellStarted: (run: Run) => void
  onError: (error: Error) => void
  onOpenChange?: (open: boolean) => void
  /** The list item; must accept a ref (rendered `asChild`). */
  children: React.ReactNode
}

export function ProjectContextMenu({
  project,
  onShowDetails,
  onRemove,
  onShellStarted,
  onError,
  onOpenChange,
  children
}: ProjectContextMenuProps): React.JSX.Element {
  const editors = useEditors()
  const openInEditor = useOpenInEditor()
  const openFolder = useOpenProjectFolder()
  const systemTerminal = useSystemTerminal()
  const openInSystemTerminal = useOpenInSystemTerminal()
  const startShell = useStartShell()

  const openShell = (): void => {
    startShell.mutate({ projectId: project.id }, { onSuccess: onShellStarted, onError })
  }

  const copyPath = (): void => {
    navigator.clipboard.writeText(project.path).catch(onError)
  }

  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48" aria-label={`${project.name} 的操作`}>
        <ContextMenuItem onSelect={onShowDetails}>
          <Info />
          显示详情
        </ContextMenuItem>
        {shell && (
          <ContextMenuItem onSelect={() => openFolder.mutate(project.id, { onError })}>
            <FolderOpen />
            打开项目目录
          </ContextMenuItem>
        )}
        {access.terminal && (
          <ContextMenuItem onSelect={openShell} disabled={startShell.isPending}>
            <SquareTerminal />在 DevHub 终端中打开
          </ContextMenuItem>
        )}
        {/* Launches programs on the host: desktop only. */}
        {access.manage && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <AppWindow />
              打开方式
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="min-w-40">
              {(editors.data ?? []).map((editor) => (
                <ContextMenuItem
                  key={editor.id}
                  disabled={!editor.available}
                  onSelect={() =>
                    openInEditor.mutate({ projectId: project.id, editor: editor.id }, { onError })
                  }
                >
                  {editor.available ? editor.name : `${editor.name}（未检测到）`}
                </ContextMenuItem>
              ))}
              {editors.isPending && <ContextMenuItem disabled>检测中…</ContextMenuItem>}
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={!systemTerminal.data}
                onSelect={() => openInSystemTerminal.mutate(project.id, { onError })}
              >
                {systemTerminal.data
                  ? `系统终端（${systemTerminal.data.name}）`
                  : systemTerminal.isPending
                    ? '系统终端（检测中…）'
                    : '系统终端（未检测到）'}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {/* Browsers only allow the clipboard on HTTPS or localhost. */}
        {navigator.clipboard && (
          <ContextMenuItem onSelect={copyPath}>
            <Copy />
            复制路径
          </ContextMenuItem>
        )}
        {access.manage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={onRemove}>
              <X />
              移除…
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
