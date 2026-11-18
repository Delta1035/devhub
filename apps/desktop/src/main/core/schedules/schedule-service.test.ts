import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type Schedule, type ScheduleTarget } from '@devhub/shared'
import {
  createScheduleService,
  type ScheduleServiceDeps,
  type SchedulesFile
} from './schedule-service'

const makeTarget = (): ScheduleTarget => ({
  kind: 'script',
  projectId: 'project-1',
  scriptId: 'build'
})

describe('createScheduleService', () => {
  let file: SchedulesFile
  let executor: ScheduleServiceDeps['executor'] & {
    isRunning: ReturnType<typeof vi.fn<ScheduleServiceDeps['executor']['isRunning']>>
    start: ReturnType<typeof vi.fn<ScheduleServiceDeps['executor']['start']>>
    stop: ReturnType<typeof vi.fn<ScheduleServiceDeps['executor']['stop']>>
  }
  let service: ReturnType<typeof createScheduleService>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 18, 8, 0))
    file = { version: 1, schedules: [] }
    executor = {
      validate: vi.fn<ScheduleServiceDeps['executor']['validate']>().mockResolvedValue(undefined),
      isRunning: vi.fn<ScheduleServiceDeps['executor']['isRunning']>().mockResolvedValue(false),
      start: vi.fn<ScheduleServiceDeps['executor']['start']>().mockResolvedValue(undefined),
      stop: vi.fn<ScheduleServiceDeps['executor']['stop']>().mockResolvedValue(undefined)
    }
    service = createScheduleService({
      store: {
        read: async () => structuredClone(file),
        write: async (next) => {
          file = structuredClone(next)
        }
      },
      executor,
      now: () => new Date()
    })
  })

  it('persists a validated schedule and calculates the next occurrence', async () => {
    const schedule = await service.save({
      name: '每小时构建',
      target: makeTarget(),
      rule: { kind: 'interval', minutes: 60 },
      overlapPolicy: 'skip',
      enabled: true
    })

    expect(schedule.nextRunAt).toBe(new Date(2026, 10, 18, 9, 0).toISOString())
    expect(file.schedules).toHaveLength(1)
    expect(executor.validate).toHaveBeenCalledWith(makeTarget())
  })

  it('skips an active target by default when the timer fires', async () => {
    executor.isRunning.mockResolvedValue(true)
    const schedule = await service.save({
      name: '不打断构建',
      target: makeTarget(),
      rule: { kind: 'interval', minutes: 1 },
      overlapPolicy: 'skip',
      enabled: true
    })
    await service.start()
    await vi.advanceTimersByTimeAsync(60_000)
    const updated = (await service.list()).find(({ id }) => id === schedule.id)

    expect(updated?.lastResult).toMatchObject({
      status: 'skipped',
      message: '目标正在运行，已跳过本次执行'
    })
    expect(executor.stop).not.toHaveBeenCalled()
    expect(executor.start).not.toHaveBeenCalled()
  })

  it('stops and restarts an active target when configured', async () => {
    executor.isRunning.mockResolvedValue(true)
    const schedule = await service.save({
      name: '重启构建',
      target: makeTarget(),
      rule: { kind: 'interval', minutes: 60 },
      overlapPolicy: 'stop-and-restart',
      enabled: false
    })

    const updated = await service.runNow(schedule.id)
    expect(updated.lastResult).toMatchObject({
      status: 'started',
      message: '已停止原运行并重新执行'
    })
    expect(executor.stop).toHaveBeenCalledWith(makeTarget())
    expect(executor.start).toHaveBeenCalledWith(makeTarget())
  })

  it('does not replay a missed one-off task after DevHub starts', async () => {
    const missed: Schedule = {
      id: 'missed',
      name: '错过的任务',
      target: makeTarget(),
      rule: { kind: 'once', at: new Date(2026, 10, 18, 7, 0).toISOString() },
      overlapPolicy: 'skip',
      enabled: true,
      createdAt: new Date(2026, 10, 17).toISOString(),
      updatedAt: new Date(2026, 10, 17).toISOString(),
      nextRunAt: new Date(2026, 10, 18, 7, 0).toISOString()
    }
    file.schedules = [missed]

    await service.start()
    const updated = (await service.list())[0]
    expect(updated).toMatchObject({ enabled: false, lastResult: { status: 'skipped' } })
    expect(updated?.lastResult?.message).toContain('未自动补执行')
    expect(executor.start).not.toHaveBeenCalled()
  })

  it('rejects duplicate names and prevents concurrent manual execution', async () => {
    const input = {
      name: '唯一任务',
      target: makeTarget(),
      rule: { kind: 'interval' as const, minutes: 60 },
      overlapPolicy: 'skip' as const,
      enabled: false
    }
    const schedule = await service.save(input)
    await expect(
      service.save({ ...input, target: { kind: 'group', groupId: 'group-1' } })
    ).rejects.toMatchObject({
      code: 'SCHEDULE_NAME_TAKEN'
    })

    const pending = new Promise<void>(() => undefined)
    executor.start.mockReturnValueOnce(pending)
    const first = service.runNow(schedule.id)
    await expect(service.runNow(schedule.id)).rejects.toMatchObject({
      code: 'SCHEDULE_ALREADY_RUNNING'
    })
    void first
  })

  it('returns a clear error for invalid cron input', async () => {
    await expect(
      service.save({
        name: '错误 Cron',
        target: makeTarget(),
        rule: { kind: 'cron', expression: '0 25 * * *' },
        overlapPolicy: 'skip',
        enabled: true
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' } satisfies Partial<DevhubError>)
  })
})
