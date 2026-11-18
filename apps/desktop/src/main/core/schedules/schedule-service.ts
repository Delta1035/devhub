import { randomUUID } from 'crypto'
import { z } from 'zod'
import {
  DevhubError,
  nextScheduleAt,
  scheduleInputSchema,
  scheduleSchema,
  validateScheduleRule,
  type DevhubEvent,
  type Schedule,
  type ScheduleInput,
  type ScheduleTarget
} from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

export const schedulesFileSchema = z.object({
  version: z.literal(1),
  schedules: z.array(scheduleSchema)
})
export type SchedulesFile = z.infer<typeof schedulesFileSchema>

export const emptySchedulesFile = (): SchedulesFile => ({ version: 1, schedules: [] })

export interface ScheduleTargetExecutor {
  validate(target: ScheduleTarget): Promise<void>
  isRunning(target: ScheduleTarget): Promise<boolean>
  start(target: ScheduleTarget): Promise<void>
  stop(target: ScheduleTarget): Promise<void>
}

export interface ScheduleService {
  list(): Promise<Schedule[]>
  save(input: unknown): Promise<Schedule>
  setEnabled(scheduleId: unknown, enabled: unknown): Promise<Schedule>
  remove(scheduleId: unknown): Promise<void>
  runNow(scheduleId: unknown): Promise<Schedule>
  start(): Promise<void>
  dispose(): Promise<void>
}

export interface ScheduleServiceDeps {
  store: JsonStore<SchedulesFile>
  executor: ScheduleTargetExecutor
  emit?: (event: DevhubEvent) => void
  now?: () => Date
  newId?: () => string
  setTimeout?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (timeout: ReturnType<typeof setTimeout>) => void
}

const idInput = z.string().min(1)
const enabledInput = z.boolean()
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export function createScheduleService({
  store,
  executor,
  emit = () => undefined,
  now = () => new Date(),
  newId = randomUUID,
  setTimeout: scheduleTimeout = setTimeout,
  clearTimeout: cancelTimeout = clearTimeout
}: ScheduleServiceDeps): ScheduleService {
  let cache: SchedulesFile | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  let started = false
  let disposed = false
  const executing = new Set<string>()
  const inFlight = new Set<Promise<unknown>>()

  const load = async (): Promise<SchedulesFile> => (cache ??= await store.read())

  const mutate = <T>(fn: (data: SchedulesFile) => Promise<T>): Promise<T> => {
    const next = queue.then(async () => {
      const data = await load()
      const result = await fn(data)
      await store.write(data)
      return result
    })
    queue = next.catch(() => undefined)
    return next
  }

  const findIndex = (data: SchedulesFile, rawId: unknown): number => {
    const parsed = idInput.safeParse(rawId)
    const index = parsed.success ? data.schedules.findIndex(({ id }) => id === parsed.data) : -1
    if (index === -1) throw new DevhubError('SCHEDULE_NOT_FOUND', '定时任务不存在或已被删除')
    return index
  }

  const nextAt = (schedule: Pick<Schedule, 'rule'>, after: Date): string | undefined => {
    const ruleError = validateScheduleRule(schedule.rule)
    if (ruleError) throw new DevhubError('INVALID_INPUT', ruleError)
    const next = nextScheduleAt(schedule.rule, after)
    return next?.toISOString()
  }

  const publish = (schedule: Schedule): void => {
    emit({ type: 'schedules-updated', schedule: structuredClone(schedule) })
  }

  const arm = async (): Promise<void> => {
    if (!started || disposed) return
    if (timer !== undefined) cancelTimeout(timer)
    timer = undefined
    const schedules = await load()
    const next = schedules.schedules
      .filter((schedule) => schedule.enabled && schedule.nextRunAt)
      .map((schedule) => Date.parse(schedule.nextRunAt ?? ''))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0]
    if (next === undefined) return
    // Wake up periodically for clock changes and for dates beyond setTimeout's safe range.
    const delay = Math.max(10, Math.min(next - now().getTime(), 60_000))
    timer = scheduleTimeout(() => {
      void processDue()
    }, delay)
  }

  const updateResult = async (
    scheduleId: string,
    result: Schedule['lastResult']
  ): Promise<Schedule> =>
    mutate(async (data) => {
      const schedule = data.schedules[findIndex(data, scheduleId)]
      if (!schedule) throw new DevhubError('SCHEDULE_NOT_FOUND', '定时任务不存在或已被删除')
      schedule.lastResult = result
      schedule.updatedAt = now().toISOString()
      return structuredClone(schedule)
    }).then((schedule) => {
      publish(schedule)
      return schedule
    })

  const executeReserved = (schedule: Schedule): Promise<Schedule> => {
    const task = (async (): Promise<Schedule> => {
      let result: Schedule['lastResult']
      try {
        const running = await executor.isRunning(schedule.target)
        if (running && schedule.overlapPolicy === 'skip') {
          result = {
            status: 'skipped',
            at: now().toISOString(),
            message: '目标正在运行，已跳过本次执行'
          }
        } else {
          if (running) await executor.stop(schedule.target)
          await executor.start(schedule.target)
          result = {
            status: 'started',
            at: now().toISOString(),
            ...(running ? { message: '已停止原运行并重新执行' } : {})
          }
        }
      } catch (error) {
        result = { status: 'failed', at: now().toISOString(), message: errorMessage(error) }
      }
      return updateResult(schedule.id, result)
    })()
    inFlight.add(task)
    void task
      .finally(() => {
        inFlight.delete(task)
        executing.delete(schedule.id)
      })
      .catch(() => undefined)
    return task
  }

  const reserve = (scheduleId: string): boolean => {
    if (executing.has(scheduleId)) return false
    executing.add(scheduleId)
    return true
  }

  const claimDue = async (scheduleId: string): Promise<Schedule | null> =>
    mutate(async (data) => {
      const schedule = data.schedules[findIndex(data, scheduleId)]
      if (
        !schedule?.enabled ||
        !schedule.nextRunAt ||
        Date.parse(schedule.nextRunAt) > now().getTime()
      ) {
        return null
      }
      if (!reserve(schedule.id)) return null
      const dueAt = new Date(schedule.nextRunAt)
      const next = nextAt(schedule, dueAt)
      if (schedule.rule.kind === 'once' || next === undefined) {
        schedule.enabled = false
        delete schedule.nextRunAt
      } else {
        schedule.nextRunAt = next
      }
      schedule.updatedAt = now().toISOString()
      return structuredClone(schedule)
    }).catch((error: unknown) => {
      if (error instanceof DevhubError && error.code === 'SCHEDULE_NOT_FOUND') return null
      throw error
    })

  const processDue = async (): Promise<void> => {
    if (disposed) return
    try {
      const schedules = await load()
      const due = schedules.schedules.filter(
        (schedule) =>
          schedule.enabled &&
          schedule.nextRunAt !== undefined &&
          Date.parse(schedule.nextRunAt) <= now().getTime()
      )
      for (const schedule of due) {
        const claimed = await claimDue(schedule.id)
        if (claimed) void executeReserved(claimed)
      }
    } catch (error) {
      console.error('[schedules] processing failed', error)
    }
    await arm()
  }

  const normalizeOnStart = async (): Promise<void> => {
    const current = now()
    const data = await load()
    let changed = false
    for (const schedule of data.schedules) {
      if (!schedule.enabled) continue
      if (schedule.nextRunAt && Date.parse(schedule.nextRunAt) > current.getTime()) continue
      if (schedule.rule.kind === 'once') {
        schedule.enabled = false
        delete schedule.nextRunAt
        schedule.lastResult = {
          status: 'skipped',
          at: current.toISOString(),
          message: 'DevHub 未运行期间错过执行，未自动补执行'
        }
        changed = true
      } else {
        const next = nextAt(schedule, current)
        if (next && schedule.nextRunAt !== next) {
          schedule.nextRunAt = next
          changed = true
        }
      }
      if (changed) schedule.updatedAt = current.toISOString()
    }
    if (changed) await store.write(data)
  }

  return {
    async list() {
      return (await load()).schedules.map((schedule) => structuredClone(schedule))
    },

    save(rawInput) {
      return mutate(async (data) => {
        const parsed = scheduleInputSchema.safeParse(rawInput)
        if (!parsed.success) throw new DevhubError('INVALID_INPUT', '定时任务内容不完整或无效')
        const input: ScheduleInput = parsed.data
        const ruleError = validateScheduleRule(input.rule)
        if (ruleError) throw new DevhubError('INVALID_INPUT', ruleError)
        await executor.validate(input.target)
        const existingIndex = input.id === undefined ? -1 : findIndex(data, input.id)
        if (
          data.schedules.some(
            (schedule, index) => index !== existingIndex && schedule.name === input.name
          )
        ) {
          throw new DevhubError('SCHEDULE_NAME_TAKEN', `已有同名的定时任务：${input.name}`)
        }
        const existing = data.schedules[existingIndex]
        const timestamp = now().toISOString()
        const schedule: Schedule = {
          id: input.id ?? newId(),
          name: input.name,
          target: input.target,
          rule: input.rule,
          overlapPolicy: input.overlapPolicy,
          enabled: input.enabled,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
          ...(input.enabled
            ? (() => {
                const next = nextAt(input, now())
                if (!next)
                  throw new DevhubError('INVALID_INPUT', '单次任务的执行时间必须晚于当前时间')
                return { nextRunAt: next }
              })()
            : {}),
          ...(existing?.lastResult ? { lastResult: existing.lastResult } : {})
        }
        if (existingIndex === -1) data.schedules.push(schedule)
        else data.schedules[existingIndex] = schedule
        return structuredClone(schedule)
      }).then(async (schedule) => {
        publish(schedule)
        await arm()
        return schedule
      })
    },

    setEnabled(rawId, rawEnabled) {
      return mutate(async (data) => {
        const parsed = enabledInput.safeParse(rawEnabled)
        if (!parsed.success) throw new DevhubError('INVALID_INPUT', '启用状态无效')
        const schedule = data.schedules[findIndex(data, rawId)]
        if (!schedule) throw new DevhubError('SCHEDULE_NOT_FOUND', '定时任务不存在或已被删除')
        if (parsed.data) {
          const next = nextAt(schedule, now())
          if (!next) throw new DevhubError('INVALID_INPUT', '单次任务的执行时间已过期，请重新编辑')
          schedule.enabled = true
          schedule.nextRunAt = next
        } else {
          schedule.enabled = false
          delete schedule.nextRunAt
        }
        schedule.updatedAt = now().toISOString()
        return structuredClone(schedule)
      }).then(async (schedule) => {
        publish(schedule)
        await arm()
        return schedule
      })
    },

    remove(rawId) {
      return mutate(async (data) => {
        const index = findIndex(data, rawId)
        const removed = data.schedules[index]
        if (!removed) throw new DevhubError('SCHEDULE_NOT_FOUND', '定时任务不存在或已被删除')
        data.schedules.splice(index, 1)
        return removed.id
      }).then(async (removedId) => {
        emit({ type: 'schedules-updated', removedId })
        await arm()
      })
    },

    async runNow(rawId) {
      if (disposed) throw new DevhubError('INTERNAL', 'DevHub 正在退出，无法执行定时任务')
      const data = await load()
      const scheduleIndex = findIndex(data, rawId)
      const stored = data.schedules[scheduleIndex]
      if (!stored) throw new DevhubError('SCHEDULE_NOT_FOUND', '定时任务不存在或已被删除')
      const schedule = structuredClone(stored)
      if (!reserve(schedule.id)) {
        throw new DevhubError('SCHEDULE_ALREADY_RUNNING', `${schedule.name} 正在执行`)
      }
      return executeReserved(schedule)
    },

    async start() {
      if (started || disposed) return
      await normalizeOnStart()
      started = true
      await arm()
    },

    async dispose() {
      disposed = true
      started = false
      if (timer !== undefined) cancelTimeout(timer)
      timer = undefined
      await Promise.allSettled([...inFlight])
    }
  }
}
