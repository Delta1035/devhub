import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { RemoteConfigPatch, RemoteState } from '@devhub/shared'
import { api } from '@renderer/api'

const remoteKey = ['remote'] as const

export function useRemoteState(): UseQueryResult<RemoteState> {
  return useQuery({ queryKey: remoteKey, queryFn: () => api.getRemoteState() })
}

export function useUpdateRemote(): UseMutationResult<RemoteState, Error, RemoteConfigPatch> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch) => api.updateRemoteConfig(patch),
    onSuccess: (state) => queryClient.setQueryData(remoteKey, state)
  })
}

export function useRegenerateRemoteToken(): UseMutationResult<RemoteState, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.regenerateRemoteToken(),
    onSuccess: (state) => queryClient.setQueryData(remoteKey, state)
  })
}
