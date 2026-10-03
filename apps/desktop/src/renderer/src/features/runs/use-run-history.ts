import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query'
import type { RunRecord } from '@devhub/shared'
import { api } from '@renderer/api'

const historyKey = (projectId: string, scriptId: string) =>
  ['run-history', projectId, scriptId] as const

/** Finished runs of a script, newest first; fetched only while `enabled` (the popover is open). */
export function useRunHistory(
  projectId: string,
  scriptId: string,
  enabled: boolean
): UseQueryResult<RunRecord[]> {
  return useQuery({
    queryKey: historyKey(projectId, scriptId),
    queryFn: () => api.listRunHistory(projectId, scriptId),
    enabled
  })
}

export function refreshHistory(
  queryClient: QueryClient,
  projectId: string,
  scriptId: string
): void {
  void queryClient.invalidateQueries({ queryKey: historyKey(projectId, scriptId) })
  void queryClient.invalidateQueries({ queryKey: ['history-output', projectId, scriptId] })
}

export function useClearRunHistory(
  projectId: string,
  scriptId: string
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.clearRunHistory(projectId, scriptId),
    onSuccess: () => refreshHistory(queryClient, projectId, scriptId)
  })
}

/** `2 分 13 秒`, `45 秒`, `1 小时 5 分` */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

/** `今天 10:32`, `昨天 23:05`, `10-01 09:15` */
export function formatStartTime(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dayStart = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000)
  if (days === 0) return `今天 ${time}`
  if (days === 1) return `昨天 ${time}`
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${time}`
}
