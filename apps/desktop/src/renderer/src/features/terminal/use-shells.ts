import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Run, ShellId, ShellInfo } from '@devhub/shared'
import { api } from '@renderer/api'

/** Installed shells; the first one is the default. */
export function useShells(): UseQueryResult<ShellInfo[]> {
  return useQuery({ queryKey: ['shells'], queryFn: () => api.listShells(), staleTime: 60_000 })
}

export interface StartShellInput {
  projectId: string
  shellId?: ShellId
}

// The runs cache is updated by the pushed run-updated event, like scripts.
export function useStartShell(): UseMutationResult<Run, Error, StartShellInput> {
  return useMutation({
    mutationFn: ({ projectId, shellId }) => api.startShell(projectId, shellId)
  })
}

/** Closing a terminal tab: stop it first if it is still running, then forget it. */
export function useCloseRun(): UseMutationResult<void, Error, Run> {
  return useMutation({
    mutationFn: async (run) => {
      if (run.status !== 'exited') await api.stopRun(run.id)
      await api.removeRun(run.id)
    }
  })
}
