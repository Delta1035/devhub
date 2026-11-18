import { describe, expect, it } from 'vitest'
import {
  nextScheduleAt,
  parseCronExpression,
  scheduleInputSchema,
  validateScheduleRule
} from './schedules'

describe('schedule rules', () => {
  it('calculates daily and weekly local times', () => {
    const after = new Date(2026, 10, 18, 8, 30)
    expect(nextScheduleAt({ kind: 'daily', time: '09:00' }, after)).toEqual(
      new Date(2026, 10, 18, 9, 0)
    )
    expect(nextScheduleAt({ kind: 'weekly', days: [4], time: '09:00' }, after)).toEqual(
      new Date(2026, 10, 19, 9, 0)
    )
  })

  it('moves a recurring rule to the next occurrence after the trigger', () => {
    const after = new Date(2026, 10, 18, 9, 0)
    expect(nextScheduleAt({ kind: 'interval', minutes: 15 }, after)).toEqual(
      new Date(2026, 10, 18, 9, 15)
    )
    expect(nextScheduleAt({ kind: 'once', at: '2026-11-18T00:00:00.000Z' }, after)).toBeNull()
  })

  it('supports cron wildcards, lists, ranges and steps', () => {
    expect(
      nextScheduleAt(
        { kind: 'cron', expression: '*/15 9-10 * * 1-5' },
        new Date(2026, 10, 18, 9, 7)
      )
    ).toEqual(new Date(2026, 10, 18, 9, 15))
    expect(
      nextScheduleAt({ kind: 'cron', expression: '30 8 1,15 * *' }, new Date(2026, 10, 18, 9, 0))
    ).toEqual(new Date(2026, 11, 1, 8, 30))
    expect(parseCronExpression('0 0 * * 0-6')).toBeTruthy()
  })

  it('uses cron day-of-month/day-of-week OR semantics when both are restricted', () => {
    const next = nextScheduleAt(
      { kind: 'cron', expression: '0 9 1 * 1' },
      new Date(2026, 10, 18, 10, 0)
    )
    expect(next).toEqual(new Date(2026, 10, 23, 9, 0))
  })

  it('rejects invalid cron rules through the shared schema helper', () => {
    const rule = { kind: 'cron' as const, expression: '0 25 * * *' }
    expect(validateScheduleRule(rule)).toContain('范围')
    expect(() =>
      scheduleInputSchema.parse({
        name: 'test',
        target: { kind: 'group', groupId: 'group-1' },
        rule,
        overlapPolicy: 'skip',
        enabled: true
      })
    ).not.toThrow()
  })
})
