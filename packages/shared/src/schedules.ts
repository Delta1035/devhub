import { z } from 'zod'

const localTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export const scheduleTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('script'),
    projectId: z.string().min(1),
    scriptId: z.string().min(1)
  }),
  z.object({ kind: z.literal('group'), groupId: z.string().min(1) })
])
export type ScheduleTarget = z.infer<typeof scheduleTargetSchema>

const scheduleTime = z.string().regex(localTimePattern, '时间必须是 HH:mm 格式')

export const scheduleRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), at: z.iso.datetime() }),
  z.object({ kind: z.literal('daily'), time: scheduleTime }),
  z.object({
    kind: z.literal('weekly'),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    time: scheduleTime
  }),
  z.object({ kind: z.literal('interval'), minutes: z.number().int().min(1).max(525600) }),
  z.object({ kind: z.literal('cron'), expression: z.string().trim().min(1).max(100) })
])
export type ScheduleRule = z.infer<typeof scheduleRuleSchema>

export const scheduleOverlapPolicySchema = z.enum(['skip', 'stop-and-restart'])
export type ScheduleOverlapPolicy = z.infer<typeof scheduleOverlapPolicySchema>

export const scheduleLastResultSchema = z.object({
  status: z.enum(['started', 'skipped', 'failed']),
  at: z.iso.datetime(),
  message: z.string().max(500).optional()
})
export type ScheduleLastResult = z.infer<typeof scheduleLastResultSchema>

export const scheduleInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60),
  target: scheduleTargetSchema,
  rule: scheduleRuleSchema,
  overlapPolicy: scheduleOverlapPolicySchema,
  enabled: z.boolean()
})
export type ScheduleInput = z.infer<typeof scheduleInputSchema>

export const scheduleSchema = scheduleInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  nextRunAt: z.iso.datetime().optional(),
  lastResult: scheduleLastResultSchema.optional()
})
export type Schedule = z.infer<typeof scheduleSchema>

export const scheduleRunStatusSchema = z.enum(['started', 'skipped', 'failed'])
export type ScheduleRunStatus = z.infer<typeof scheduleRunStatusSchema>

const cronRanges = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 6 }
] as const

type CronField = ReadonlySet<number>
interface ParsedCron {
  fields: readonly [CronField, CronField, CronField, CronField, CronField]
  restrictedDayOfMonth: boolean
  restrictedDayOfWeek: boolean
}

const parseCronPart = (part: string, min: number, max: number): number[] => {
  const parts = part.split('/')
  const rangePart = parts[0]
  const stepPart = parts[1]
  if (!rangePart || parts.length > 2 || stepPart === '') throw new Error('Cron 步长无效')
  const step = stepPart === undefined ? 1 : Number(stepPart)
  if (!Number.isInteger(step) || step < 1) throw new Error('Cron 步长无效')

  const bounds = rangePart === '*' ? [min, max] : rangePart.split('-').map(Number)
  const start = bounds[0]
  const end = bounds[1] ?? start
  if (
    bounds.length > 2 ||
    bounds.some((value) => !Number.isInteger(value)) ||
    start === undefined ||
    end === undefined ||
    start < min ||
    start > max ||
    (bounds.length === 2 && (end < start || end > max))
  ) {
    throw new Error('Cron 范围无效')
  }
  const values: number[] = []
  for (let value = start; value <= end; value += step) values.push(value)
  return values
}

const parseCronField = (field: string, min: number, max: number): CronField => {
  if (field.trim() === '') throw new Error('Cron 字段不能为空')
  const values = new Set<number>()
  for (const part of field.split(',')) {
    if (part === '') throw new Error('Cron 列表无效')
    parseCronPart(part, min, max).forEach((value) => values.add(value))
  }
  return values
}

export function parseCronExpression(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error('Cron 必须包含 5 个字段')
  const fields = parts.map((part, index) => {
    const range = cronRanges[index]
    if (!range) throw new Error('Cron 字段数量无效')
    return parseCronField(part, range.min, range.max)
  })
  const [minute, hour, day, month, weekday] = fields
  if (!minute || !hour || !day || !month || !weekday) throw new Error('Cron 字段数量无效')
  return {
    fields: [minute, hour, day, month, weekday],
    restrictedDayOfMonth: parts[2] !== '*',
    restrictedDayOfWeek: parts[4] !== '*'
  }
}

const timeParts = (time: string): { hours: number; minutes: number } => ({
  hours: Number(time.slice(0, 2)),
  minutes: Number(time.slice(3, 5))
})

const localDateAt = (date: Date, time: string): Date => {
  const { hours, minutes } = timeParts(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0)
}

const nextCalendarDate = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const cronMatches = (date: Date, cron: ParsedCron): boolean => {
  const [minute, hour, day, month, weekday] = cron.fields
  if (!minute.has(date.getMinutes()) || !hour.has(date.getHours())) return false
  if (!month.has(date.getMonth() + 1)) return false
  const dayMatches = day.has(date.getDate())
  const weekdayMatches = weekday.has(date.getDay())
  if (cron.restrictedDayOfMonth && cron.restrictedDayOfWeek) {
    return dayMatches || weekdayMatches
  }
  return dayMatches && weekdayMatches
}

const nextCronAt = (expression: string, after: Date): Date | null => {
  const cron = parseCronExpression(expression)
  const candidate = new Date(after)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)
  const limit = candidate.getTime() + 366 * 24 * 60 * 60 * 1000
  while (candidate.getTime() <= limit) {
    if (cronMatches(candidate, cron)) return candidate
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return null
}

const nextWeeklyAt = (rule: Extract<ScheduleRule, { kind: 'weekly' }>, after: Date): Date => {
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = nextCalendarDate(after, offset)
    if (!rule.days.includes(date.getDay())) continue
    const candidate = localDateAt(date, rule.time)
    if (candidate > after) return candidate
  }
  return localDateAt(nextCalendarDate(after, 7), rule.time)
}

/** Returns the first occurrence strictly after `after`, or null for an expired one-off task. */
export function nextScheduleAt(rule: ScheduleRule, after: Date): Date | null {
  if (rule.kind === 'once') {
    const at = new Date(rule.at)
    return at > after ? at : null
  }
  if (rule.kind === 'interval') return new Date(after.getTime() + rule.minutes * 60_000)
  if (rule.kind === 'cron') return nextCronAt(rule.expression, after)
  if (rule.kind === 'daily') {
    const today = localDateAt(after, rule.time)
    return today > after ? today : localDateAt(nextCalendarDate(after, 1), rule.time)
  }
  return nextWeeklyAt(rule, after)
}

/** Validates a rule and returns a user-facing error instead of throwing from the caller. */
export function validateScheduleRule(rule: ScheduleRule): string | null {
  if (rule.kind !== 'cron') return null
  try {
    parseCronExpression(rule.expression)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Cron 表达式无效'
  }
}
