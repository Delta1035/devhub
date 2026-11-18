import type { DevhubApi, Schedule, ScheduleInput } from '@devhub/shared'
import { mockEvents } from './mock-events'

type MockScheduleApi = Pick<
  DevhubApi,
  'listSchedules' | 'saveSchedule' | 'setScheduleEnabled' | 'deleteSchedule' | 'runScheduleNow'
>

export function createMockScheduleApi(): MockScheduleApi {
  const schedules: Schedule[] = []

  return {
    async listSchedules(): Promise<Schedule[]> {
      return schedules.map((schedule) => structuredClone(schedule))
    },

    async saveSchedule(input: ScheduleInput): Promise<Schedule> {
      const now = new Date().toISOString()
      const existingIndex = input.id
        ? schedules.findIndex((schedule) => schedule.id === input.id)
        : -1
      const existing = existingIndex === -1 ? undefined : schedules[existingIndex]
      const schedule: Schedule = {
        ...input,
        id: input.id ?? `schedule-${Date.now()}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        nextRunAt: input.enabled ? new Date(Date.now() + 60_000).toISOString() : undefined,
        lastResult: existing?.lastResult
      }
      if (existingIndex === -1) schedules.push(schedule)
      else schedules[existingIndex] = schedule
      mockEvents.emit({ type: 'schedules-updated', schedule })
      return structuredClone(schedule)
    },

    async setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<Schedule> {
      const schedule = schedules.find((candidate) => candidate.id === scheduleId)
      if (!schedule) throw new Error('定时任务不存在')
      schedule.enabled = enabled
      schedule.updatedAt = new Date().toISOString()
      schedule.nextRunAt = enabled ? new Date(Date.now() + 60_000).toISOString() : undefined
      mockEvents.emit({ type: 'schedules-updated', schedule })
      return structuredClone(schedule)
    },

    async deleteSchedule(scheduleId: string): Promise<void> {
      const index = schedules.findIndex((schedule) => schedule.id === scheduleId)
      if (index !== -1) schedules.splice(index, 1)
    },

    async runScheduleNow(scheduleId: string): Promise<Schedule> {
      const schedule = schedules.find((candidate) => candidate.id === scheduleId)
      if (!schedule) throw new Error('定时任务不存在')
      schedule.lastResult = { status: 'started', at: new Date().toISOString() }
      schedule.updatedAt = new Date().toISOString()
      mockEvents.emit({ type: 'schedules-updated', schedule })
      return structuredClone(schedule)
    }
  }
}
