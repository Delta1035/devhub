import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Project } from '@devhub/shared'
import { api, shell } from '@renderer/api'

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

/** Desktop only: hide the entry when `shell` is null (remote clients). */
export function useOpenProjectFolder(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: async (projectId: string) => {
      if (!shell) throw new Error('仅桌面端可以打开项目目录')
      await shell.openProjectFolder(projectId)
    }
  })
}

export function useRemoveProject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.removeProject(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey })
  })
}
