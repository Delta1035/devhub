import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Run } from '@devhub/shared'
import { api, events } from '@renderer/api'

const runsKey = ['runs'] as const

export function useRuns(): UseQueryResult<Run[]> {
  return useQuery({ queryKey: runsKey, queryFn: () => api.listRuns() })
}

/** Keeps the runs cache in sync with pushed events. Mount once, near the app root. */
export function useRunEventsSync(): void {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type === 'run-updated') {
          queryClient.setQueryData<Run[]>(runsKey, (runs = []) => {
            const others = runs.filter((run) => run.id !== event.run.id)
            return [...others, event.run]
          })
        } else if (event.type === 'run-removed') {
          queryClient.setQueryData<Run[]>(runsKey, (runs = []) =>
            runs.filter((run) => run.id !== event.runId)
          )
        }
      }),
    [queryClient]
  )
}

export interface StartScriptInput {
  projectId: string
  scriptId: string
}

// Mutations need no cache updates: the core pushes run-updated / run-removed events.

export function useStartScript(): UseMutationResult<Run, Error, StartScriptInput> {
  return useMutation({
    mutationFn: ({ projectId, scriptId }) => api.startScript(projectId, scriptId)
  })
}

export function useStopRun(): UseMutationResult<void, Error, string> {
  return useMutation({ mutationFn: (runId) => api.stopRun(runId) })
}

export function useRestartRun(): UseMutationResult<Run, Error, string> {
  return useMutation({ mutationFn: (runId) => api.restartRun(runId) })
}

export function useRemoveRun(): UseMutationResult<void, Error, string> {
  return useMutation({ mutationFn: (runId) => api.removeRun(runId) })
}
