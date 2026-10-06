import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { describePortConflicts, type PortConflict, type Run } from '@devhub/shared'
import { useDevhub } from '@/api'

const runsKey = ['runs'] as const

/** A script's port is taken; the screen offers to start it anyway. */
export class PortConflictError extends Error {
  constructor(readonly conflicts: PortConflict[]) {
    super(describePortConflicts(conflicts))
    this.name = 'PortConflictError'
  }
}

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

export interface StartScriptInput {
  projectId: string
  scriptId: string
  ignorePortConflicts?: boolean
}

// Mutations need no cache updates: the core pushes run-updated / run-removed events.

export function useStartScript(): UseMutationResult<Run, Error, StartScriptInput> {
  const { api } = useDevhub()
  return useMutation({
    mutationFn: async ({ projectId, scriptId, ignorePortConflicts }) => {
      // Ask first so the user can decide; the core checks again in case a port was taken since.
      if (!ignorePortConflicts) {
        const conflicts = await api.checkScriptPorts(projectId, scriptId)
        if (conflicts.length > 0) throw new PortConflictError(conflicts)
      }
      return api.startScript(projectId, scriptId, { ignorePortConflicts })
    }
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
