import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ProjectScripts } from '@devhub/shared'
import { api } from '@renderer/api'

// Nested under ['projects'] so invalidating the project list also rescans scripts.
const scriptsKey = (projectId: string) => ['projects', projectId, 'scripts'] as const

/** Rescans on mount and on window focus, so edits made outside DevHub show up on return. */
export function useProjectScripts(projectId: string): UseQueryResult<ProjectScripts> {
  return useQuery({ queryKey: scriptsKey(projectId), queryFn: () => api.listScripts(projectId) })
}
