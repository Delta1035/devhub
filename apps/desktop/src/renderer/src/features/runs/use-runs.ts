import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Run } from '@devhub/shared'
import { api } from '@renderer/api'

const runsKey = ['runs'] as const

/**
 * Polls while any run is active so status changes show up.
 * Temporary: replaced by pushed events once log streaming lands.
 */
export function useRuns(): UseQueryResult<Run[]> {
  return useQuery({
    queryKey: runsKey,
    queryFn: () => api.listRuns(),
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status !== 'exited') ? 1000 : false
  })
}

export interface StartScriptInput {
  projectId: string
  scriptId: string
}

export function useStartScript(): UseMutationResult<Run, Error, StartScriptInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, scriptId }) => api.startScript(projectId, scriptId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: runsKey })
  })
}

export function useStopRun(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId) => api.stopRun(runId),
    // Refresh right away so the "stopping" state shows while the tree shuts down.
    onMutate: () => queryClient.invalidateQueries({ queryKey: runsKey }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: runsKey })
  })
}

export function useRestartRun(): UseMutationResult<Run, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId) => api.restartRun(runId),
    onMutate: () => queryClient.invalidateQueries({ queryKey: runsKey }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: runsKey })
  })
}
