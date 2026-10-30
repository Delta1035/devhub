import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ProjectScripts } from '@devhub/shared'
import { api } from '@renderer/api'

// Nested under ['projects'] so invalidating the project list also rescans scripts.
const scriptsKey = (projectId: string) => ['projects', projectId, 'scripts'] as const

/** Reuses recent scans across hover cards; stale results refresh on mount or window focus. */
export function useProjectScripts(projectId: string): UseQueryResult<ProjectScripts> {
  return useQuery({
    queryKey: scriptsKey(projectId),
    queryFn: () => api.listScripts(projectId),
    staleTime: 30_000,
    // Pickers render before a project is chosen.
    enabled: projectId !== ''
  })
}
