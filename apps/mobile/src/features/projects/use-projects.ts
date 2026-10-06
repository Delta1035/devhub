import { useEffect } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { Project, ProjectScripts } from '@devhub/shared'
import { useDevhub } from '@/api'

const projectsKey = ['projects'] as const
const scriptsKey = (projectId: string): readonly string[] => ['scripts', projectId]

export function useProjects(): UseQueryResult<Project[]> {
  const { api } = useDevhub()
  return useQuery({ queryKey: projectsKey, queryFn: () => api.listProjects() })
}

export function useScripts(projectId: string): UseQueryResult<ProjectScripts> {
  const { api } = useDevhub()
  return useQuery({ queryKey: scriptsKey(projectId), queryFn: () => api.listScripts(projectId) })
}

/** A workspace rescan on the desktop changed projects or their scripts. Mount once. */
export function useProjectEventsSync(): void {
  const { events } = useDevhub()
  const queryClient = useQueryClient()
  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type !== 'projects-updated') return
        void queryClient.invalidateQueries({ queryKey: projectsKey })
        void queryClient.invalidateQueries({ queryKey: ['scripts'] })
      }),
    [events, queryClient]
  )
}
