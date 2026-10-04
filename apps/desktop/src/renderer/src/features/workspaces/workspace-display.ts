import { useState } from 'react'
import type { WorkspaceView } from '@devhub/shared'

const collapsedKey = 'devhub.collapsedWorkspaces'

/** Which workspaces are collapsed in the sidebar; a display preference kept on this device. */
export function useCollapsedWorkspaces(): [Set<string>, (workspaceId: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed())
  const toggle = (workspaceId: string): void => {
    const next = new Set(collapsed)
    if (!next.delete(workspaceId)) next.add(workspaceId)
    setCollapsed(next)
    try {
      localStorage.setItem(collapsedKey, JSON.stringify([...next]))
    } catch {
      // Storage may be unavailable; the state still holds for this session.
    }
  }
  return [collapsed, toggle]
}

function readCollapsed(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(collapsedKey) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Path below the workspace root, for display; the full path when it is not below it. */
export function relativeToWorkspace(path: string, workspace: WorkspaceView): string {
  const rest = path.startsWith(workspace.path) ? path.slice(workspace.path.length) : ''
  // The separator check keeps `/code-old/x` from showing as below `/code`.
  return /^[\\/]./.test(rest) ? rest.replace(/^[\\/]+/, '') : path
}
