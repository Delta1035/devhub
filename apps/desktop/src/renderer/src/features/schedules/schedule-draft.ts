import {
  scheduleInputSchema,
  validateScheduleRule,
  type Schedule,
  type ScheduleInput,
  type ScheduleRule
} from '@devhub/shared'

export type DraftRuleKind = ScheduleRule['kind']

export interface ScheduleDraft {
  name: string
  targetKind: 'script' | 'group'
  projectId: string
  scriptId: string
  groupId: string
  ruleKind: DraftRuleKind
  onceAt: string
  time: string
  days: number[]
  intervalMinutes: string
  cron: string
  overlapPolicy: 'skip' | 'stop-and-restart'
  enabled: boolean
}

const pad = (value: number): string => String(value).padStart(2, '0')

export function localDateTimeInput(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function defaultScheduleDraft(): ScheduleDraft {
  return {
    name: '',
    targetKind: 'script',
    projectId: '',
    scriptId: '',
    groupId: '',
    ruleKind: 'daily',
    onceAt: localDateTimeInput(new Date(Date.now() + 60 * 60_000).toISOString()),
    time: '09:00',
    days: [1, 2, 3, 4, 5],
    intervalMinutes: '60',
    cron: '0 9 * * 1-5',
    overlapPolicy: 'skip',
    enabled: true
  }
}

export function draftFromSchedule(schedule: Schedule): ScheduleDraft {
  const draft = defaultScheduleDraft()
  const target = schedule.target
  const rule = schedule.rule
  return {
    ...draft,
    name: schedule.name,
    targetKind: target.kind,
    projectId: target.kind === 'script' ? target.projectId : '',
    scriptId: target.kind === 'script' ? target.scriptId : '',
    groupId: target.kind === 'group' ? target.groupId : '',
    ruleKind: rule.kind,
    onceAt: rule.kind === 'once' ? localDateTimeInput(rule.at) : draft.onceAt,
    time: 'time' in rule ? rule.time : draft.time,
    days: rule.kind === 'weekly' ? rule.days : draft.days,
    intervalMinutes: rule.kind === 'interval' ? String(rule.minutes) : draft.intervalMinutes,
    cron: rule.kind === 'cron' ? rule.expression : draft.cron,
    overlapPolicy: schedule.overlapPolicy,
    enabled: schedule.enabled
  }
}

export function toScheduleInput(
  draft: ScheduleDraft,
  id?: string
): { input: ScheduleInput } | { error: string } {
  const target =
    draft.targetKind === 'script'
      ? { kind: 'script' as const, projectId: draft.projectId, scriptId: draft.scriptId }
      : { kind: 'group' as const, groupId: draft.groupId }
  let rule: ScheduleRule
  if (draft.ruleKind === 'once') {
    const at = new Date(draft.onceAt)
    if (Number.isNaN(at.getTime())) return { error: '请选择有效的执行时间' }
    rule = { kind: 'once', at: at.toISOString() }
  } else if (draft.ruleKind === 'daily') {
    rule = { kind: 'daily', time: draft.time }
  } else if (draft.ruleKind === 'weekly') {
    rule = { kind: 'weekly', days: draft.days, time: draft.time }
  } else if (draft.ruleKind === 'interval') {
    const minutes = Number(draft.intervalMinutes)
    rule = { kind: 'interval', minutes }
  } else {
    rule = { kind: 'cron', expression: draft.cron }
  }
  const ruleError = validateScheduleRule(rule)
  if (ruleError) return { error: ruleError }
  const result = scheduleInputSchema.safeParse({
    ...(id ? { id } : {}),
    name: draft.name,
    target,
    rule,
    overlapPolicy: draft.overlapPolicy,
    enabled: draft.enabled
  })
  return result.success ? { input: result.data } : { error: '定时任务内容不完整或无效' }
}
