import { useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { DevhubEvent, RunHealth } from '@devhub/shared'
import { api } from '@renderer/api'

const healthKey = ['run-health'] as const

/** Readiness of every checked run (ADR 0011); kept current by `run-health` events. */
export function useRunHealth(): UseQueryResult<RunHealth[]> {
  return useQuery({ queryKey: healthKey, queryFn: () => api.listRunHealth() })
}

/** The readiness of one run; undefined when it is not checked (no known port, not running). */
export function useHealthOf(runId: string | undefined): RunHealth | undefined {
  const { data } = useRunHealth()
  return runId ? data?.find((health) => health.runId === runId) : undefined
}

/** Applies a pushed `run-health` event to the cache; called from `useRunEventsSync`. */
export function applyHealthEvent(
  queryClient: QueryClient,
  event: Extract<DevhubEvent, { type: 'run-health' }>
): void {
  queryClient.setQueryData<RunHealth[]>(healthKey, (all = []) => {
    const others = all.filter((health) => health.runId !== event.runId)
    return event.health ? [...others, event.health] : others
  })
}

export const healthLabels: Record<RunHealth['state'], string> = {
  starting: '启动中',
  ready: '就绪',
  unhealthy: '无响应'
}
