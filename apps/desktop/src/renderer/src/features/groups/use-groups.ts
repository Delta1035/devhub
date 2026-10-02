import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Group, GroupInput, GroupRunState } from '@devhub/shared'
import { api, events } from '@renderer/api'

const groupsKey = ['groups'] as const
const groupStatesKey = ['group-states'] as const

export function useGroups(): UseQueryResult<Group[]> {
  return useQuery({ queryKey: groupsKey, queryFn: () => api.listGroups() })
}

export function useGroupStates(): UseQueryResult<GroupRunState[]> {
  return useQuery({ queryKey: groupStatesKey, queryFn: () => api.listGroupStates() })
}

/** Keeps group progress in sync with pushed events. Mount once, near the app root. */
export function useGroupEventsSync(): void {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type !== 'group-updated') return
        queryClient.setQueryData<GroupRunState[]>(groupStatesKey, (states = []) => [
          ...states.filter((state) => state.groupId !== event.state.groupId),
          event.state
        ])
      }),
    [queryClient]
  )
}

export function useSaveGroup(): UseMutationResult<Group, Error, GroupInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => api.saveGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupsKey })
  })
}

export function useDeleteGroup(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (groupId) => api.deleteGroup(groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupsKey })
  })
}

export function useStartGroup(): UseMutationResult<GroupRunState, Error, string> {
  return useMutation({ mutationFn: (groupId) => api.startGroup(groupId) })
}

export function useStopGroup(): UseMutationResult<void, Error, string> {
  return useMutation({ mutationFn: (groupId) => api.stopGroup(groupId) })
}
