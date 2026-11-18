import { describe, expect, it } from 'vitest'
import { defaultScheduleDraft, toScheduleInput } from './schedule-draft'

describe('schedule draft conversion', () => {
  it('converts a script target and cron rule to the shared input', () => {
    const draft = {
      ...defaultScheduleDraft(),
      name: '工作日构建',
      projectId: 'project-1',
      scriptId: 'build',
      ruleKind: 'cron' as const,
      cron: '0 9 * * 1-5'
    }
    expect(toScheduleInput(draft)).toEqual({
      input: {
        name: '工作日构建',
        target: { kind: 'script', projectId: 'project-1', scriptId: 'build' },
        rule: { kind: 'cron', expression: '0 9 * * 1-5' },
        overlapPolicy: 'skip',
        enabled: true
      }
    })
  })

  it('converts a weekly group target and rejects empty days', () => {
    const draft = {
      ...defaultScheduleDraft(),
      name: '每周批量任务',
      targetKind: 'group' as const,
      groupId: 'group-1',
      ruleKind: 'weekly' as const,
      days: []
    }
    expect(toScheduleInput(draft)).toEqual({ error: '定时任务内容不完整或无效' })
  })

  it('reports invalid cron expressions before calling the API', () => {
    const draft = {
      ...defaultScheduleDraft(),
      name: '错误任务',
      cron: '0 25 * * *',
      ruleKind: 'cron' as const
    }
    expect(toScheduleInput(draft)).toEqual({ error: 'Cron 范围无效' })
  })
})
