import type { UseQueryResult } from '@tanstack/react-query'
import type { EditorId, EditorInfo, Project, Run, SystemTerminalInfo } from '@devhub/shared'
import {
  useEditors,
  useOpenInEditor,
  useOpenInSystemTerminal,
  useSystemTerminal
} from '@renderer/features/editors/use-editors'
import { useStartShell } from '@renderer/features/terminal/use-shells'
import { useOpenProjectFolder } from './use-projects'

/**
 * A project's actions, offered both as its context menu (right click) and as a "more" button
 * for touch screens, which have no right click.
 */
export interface ProjectMenuActions {
  editors: UseQueryResult<EditorInfo[]>
  systemTerminal: UseQueryResult<SystemTerminalInfo | null>
  shellPending: boolean
  openFolder: () => void
  openShell: () => void
  openInEditor: (editor: EditorId) => void
  openInSystemTerminal: () => void
  copyPath: () => void
}

/**
 * Called by the list item, which outlives its menus: a mutation's per-call callbacks are dropped
 * when the component that called it has unmounted, as menu content does once an item is chosen.
 */
export function useProjectMenuActions(
  project: Project,
  {
    onShellStarted,
    onError
  }: {
    /** Called with the interactive shell just opened, so its terminal tab can be shown. */
    onShellStarted: (run: Run) => void
    onError: (error: Error) => void
  }
): ProjectMenuActions {
  const editors = useEditors()
  const openInEditor = useOpenInEditor()
  const openFolder = useOpenProjectFolder()
  const systemTerminal = useSystemTerminal()
  const openInSystemTerminal = useOpenInSystemTerminal()
  const startShell = useStartShell()

  return {
    editors,
    systemTerminal,
    shellPending: startShell.isPending,
    openFolder: () => openFolder.mutate(project.id, { onError }),
    openShell: () =>
      startShell.mutate({ projectId: project.id }, { onSuccess: onShellStarted, onError }),
    openInEditor: (editor) => openInEditor.mutate({ projectId: project.id, editor }, { onError }),
    openInSystemTerminal: () => openInSystemTerminal.mutate(project.id, { onError }),
    copyPath: () => {
      navigator.clipboard.writeText(project.path).catch(onError)
    }
  }
}
