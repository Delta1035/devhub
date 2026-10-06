import { AppWindow, Copy, Ellipsis, FolderOpen, Info, SquareTerminal, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { access, shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import type { ProjectMenuActions } from './use-project-menu-actions'

interface ProjectMenuProps {
  project: Project
  actions: ProjectMenuActions
  onShowDetails: () => void
  /** Opens the confirmation; nothing is removed from the menu directly. */
  onRemove: () => void
  onOpenChange?: (open: boolean) => void
}

export function ProjectContextMenu({
  children,
  onOpenChange,
  ...props
}: ProjectMenuProps & {
  /** The list item; must accept a ref (rendered `asChild`). */
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <ContextMenu onOpenChange={onOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48" aria-label={`${props.project.name} 的操作`}>
        <ProjectMenuItems parts={contextParts} {...props} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The same actions behind a button, for touch screens and phone-sized windows. */
export function ProjectMoreMenu({
  className,
  onOpenChange,
  ...props
}: ProjectMenuProps & { className?: string }): React.JSX.Element {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          title="更多操作"
          aria-label={`${props.project.name} 的更多操作`}
          className={cn(
            'hidden pointer-coarse:inline-flex max-md:inline-flex max-md:size-8',
            className
          )}
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        aria-label={`${props.project.name} 的操作`}
      >
        <ProjectMenuItems parts={dropdownParts} {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The pieces both Radix menus provide with the same props. */
interface MenuParts {
  Item: React.ComponentType<{
    onSelect?: () => void
    disabled?: boolean
    variant?: 'default' | 'destructive'
    children: React.ReactNode
  }>
  Separator: React.ComponentType
  Sub: React.ComponentType<{ children: React.ReactNode }>
  SubTrigger: React.ComponentType<{ children: React.ReactNode }>
  SubContent: React.ComponentType<{ className?: string; children: React.ReactNode }>
}

const contextParts: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent
}

const dropdownParts: MenuParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent
}

function ProjectMenuItems({
  parts: { Item, Separator, Sub, SubTrigger, SubContent },
  actions,
  onShowDetails,
  onRemove
}: Omit<ProjectMenuProps, 'onOpenChange'> & { parts: MenuParts }): React.JSX.Element {
  const { editors, systemTerminal } = actions
  return (
    <>
      <Item onSelect={onShowDetails}>
        <Info />
        显示详情
      </Item>
      {shell && (
        <Item onSelect={actions.openFolder}>
          <FolderOpen />
          打开项目目录
        </Item>
      )}
      {access.terminal && (
        <Item onSelect={actions.openShell} disabled={actions.shellPending}>
          <SquareTerminal />在 DevHub 终端中打开
        </Item>
      )}
      {/* Launches programs on the host: desktop only. */}
      {access.manage && (
        <Sub>
          <SubTrigger>
            <AppWindow />
            打开方式
          </SubTrigger>
          <SubContent className="min-w-40">
            {(editors.data ?? []).map((editor) => (
              <Item
                key={editor.id}
                disabled={!editor.available}
                onSelect={() => actions.openInEditor(editor.id)}
              >
                {editor.available ? editor.name : `${editor.name}（未检测到）`}
              </Item>
            ))}
            {editors.isPending && <Item disabled>检测中…</Item>}
            <Separator />
            <Item disabled={!systemTerminal.data} onSelect={actions.openInSystemTerminal}>
              {systemTerminal.data
                ? `系统终端（${systemTerminal.data.name}）`
                : systemTerminal.isPending
                  ? '系统终端（检测中…）'
                  : '系统终端（未检测到）'}
            </Item>
          </SubContent>
        </Sub>
      )}
      {/* Browsers only allow the clipboard on HTTPS or localhost. */}
      {navigator.clipboard && (
        <Item onSelect={actions.copyPath}>
          <Copy />
          复制路径
        </Item>
      )}
      {access.manage && (
        <>
          <Separator />
          <Item variant="destructive" onSelect={onRemove}>
            <X />
            移除…
          </Item>
        </>
      )}
    </>
  )
}
