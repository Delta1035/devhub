import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { EditorId, EditorInfo, SystemTerminalInfo } from '@devhub/shared'
import { api } from '@renderer/api'

/** Re-checked on window focus, so installing an editor shows up without restarting DevHub. */
export function useEditors(): UseQueryResult<EditorInfo[]> {
  return useQuery({ queryKey: ['editors'], queryFn: () => api.listEditors() })
}

export interface OpenInEditorInput {
  projectId: string
  editor: EditorId
}

export function useOpenInEditor(): UseMutationResult<void, Error, OpenInEditorInput> {
  return useMutation({
    mutationFn: ({ projectId, editor }) => api.openInEditor(projectId, editor)
  })
}

/** Windows Terminal, GNOME Terminal…; null when none is installed. Re-checked on focus. */
export function useSystemTerminal(): UseQueryResult<SystemTerminalInfo | null> {
  return useQuery({ queryKey: ['system-terminal'], queryFn: () => api.getSystemTerminal() })
}

export function useOpenInSystemTerminal(): UseMutationResult<void, Error, string> {
  return useMutation({ mutationFn: (projectId: string) => api.openInSystemTerminal(projectId) })
}
