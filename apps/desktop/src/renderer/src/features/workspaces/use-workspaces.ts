import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { WorkspacePatch, WorkspaceView } from '@devhub/shared'
import { api, events } from '@renderer/api'

const workspacesKey = ['workspaces'] as const
const projectsKey = ['projects'] as const

/**
 * The app mounts this query once; opening the mobile drawer must not start another scan.
 * Window focus still rescans so projects changed outside DevHub show up on return.
 */
export function useWorkspaces(): UseQueryResult<WorkspaceView[]> {
  return useQuery({
    queryKey: workspacesKey,
    queryFn: () => api.rescanWorkspaces(),
    refetchOnMount: false,
    refetchOnWindowFocus: 'always'
  })
}

/** Reloads both lists without triggering another scan. */
async function refresh(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: projectsKey })
  queryClient.setQueryData(workspacesKey, await api.listWorkspaces())
}

/** Follows changes the core makes on its own (a startup rescan). Mount once, near the root. */
export function useWorkspaceEventsSync(): void {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type !== 'projects-updated') return
        refresh(queryClient).catch((error: unknown) => {
          console.error('Failed to reload projects', error)
        })
      }),
    [queryClient]
  )
}

export function useAddWorkspace(): UseMutationResult<WorkspaceView, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path) => api.addWorkspace(path),
    onSuccess: () => refresh(queryClient)
  })
}

export function useUpdateWorkspace(): UseMutationResult<
  WorkspaceView,
  Error,
  { workspaceId: string; patch: WorkspacePatch }
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, patch }) => api.updateWorkspace(workspaceId, patch),
    onSuccess: () => refresh(queryClient)
  })
}

export function useRemoveWorkspace(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workspaceId) => api.removeWorkspace(workspaceId),
    onSuccess: () => refresh(queryClient)
  })
}

export function useRescanWorkspaces(): UseMutationResult<WorkspaceView[], Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.rescanWorkspaces(),
    onSuccess: (views) => queryClient.setQueryData(workspacesKey, views)
  })
}
