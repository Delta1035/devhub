import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { startScriptWithPortPolicy, type Run, type StartScriptInput } from '@devhub/shared'
import { useDevhub } from '@/api'

export { PortConflictError, type StartScriptInput } from '@devhub/shared'

const runsKey = ['runs'] as const

export function useRuns(): UseQueryResult<Run[]> {
  const { api } = useDevhub()
  return useQuery({ queryKey: runsKey, queryFn: () => api.listRuns() })
}

/** Keeps the runs cache in sync with pushed events. Mount once, near the app root. */
export function useRunEventsSync(): void {
  const { events } = useDevhub()
  const queryClient = useQueryClient()
  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type === 'run-updated') {
          queryClient.setQueryData<Run[]>(runsKey, (runs = []) => [
            ...runs.filter((run) => run.id !== event.run.id),
            event.run
          ])
        } else if (event.type === 'run-removed') {
          queryClient.setQueryData<Run[]>(runsKey, (runs = []) =>
            runs.filter((run) => run.id !== event.runId)
          )
        }
      }),
    [events, queryClient]
  )
}

// Mutations need no cache updates: the core pushes run-updated / run-removed events.

export function useStartScript(): UseMutationResult<Run, Error, StartScriptInput> {
  const { api } = useDevhub()
  return useMutation({
    mutationFn: (input) => startScriptWithPortPolicy(api, input)
  })
}

export function useStopRun(): UseMutationResult<void, Error, string> {
  const { api } = useDevhub()
  return useMutation({ mutationFn: (runId) => api.stopRun(runId) })
}

export function useRestartRun(): UseMutationResult<Run, Error, string> {
  const { api } = useDevhub()
  return useMutation({ mutationFn: (runId) => api.restartRun(runId) })
}
