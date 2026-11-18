import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Schedule, ScheduleInput } from '@devhub/shared'
import { api, events } from '@renderer/api'

const schedulesKey = ['schedules'] as const

export function useSchedules(): UseQueryResult<Schedule[]> {
  return useQuery({ queryKey: schedulesKey, queryFn: () => api.listSchedules() })
}

/** Keeps schedule definitions and execution results in sync with the core. */
export function useScheduleEventsSync(): void {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type !== 'schedules-updated') return
        queryClient.setQueryData<Schedule[]>(schedulesKey, (schedules = []) => {
          if (event.removedId)
            return schedules.filter((schedule) => schedule.id !== event.removedId)
          if (!event.schedule) return schedules
          const index = schedules.findIndex((schedule) => schedule.id === event.schedule?.id)
          if (index === -1) return [...schedules, event.schedule]
          const next = [...schedules]
          next[index] = event.schedule
          return next
        })
      }),
    [queryClient]
  )
}

export function useSaveSchedule(): UseMutationResult<Schedule, Error, ScheduleInput> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input) => api.saveSchedule(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schedulesKey })
  })
}

export function useSetScheduleEnabled(): UseMutationResult<
  Schedule,
  Error,
  { scheduleId: string; enabled: boolean }
> {
  return useMutation({
    mutationFn: ({ scheduleId, enabled }) => api.setScheduleEnabled(scheduleId, enabled)
  })
}

export function useDeleteSchedule(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scheduleId) => api.deleteSchedule(scheduleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schedulesKey })
  })
}

export function useRunScheduleNow(): UseMutationResult<Schedule, Error, string> {
  return useMutation({ mutationFn: (scheduleId) => api.runScheduleNow(scheduleId) })
}
