import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AppInfo } from '@devhub/shared'
import { api } from '@renderer/api'

export function useAppInfo(): UseQueryResult<AppInfo> {
  return useQuery({ queryKey: ['app-info'], queryFn: () => api.getAppInfo() })
}
