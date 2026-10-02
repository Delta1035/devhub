import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Project } from '@devhub/shared'
import { api } from '@renderer/api'

const projectsKey = ['projects'] as const

export function useProjects(): UseQueryResult<Project[]> {
  return useQuery({ queryKey: projectsKey, queryFn: () => api.listProjects() })
}

export function useAddProject(): UseMutationResult<Project, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => api.addProject(path),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey })
  })
}

export function useRemoveProject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.removeProject(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey })
  })
}
