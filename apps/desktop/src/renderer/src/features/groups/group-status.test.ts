import { describe, expect, it } from 'vitest'
import type { ActiveGroup, Group, GroupRunState } from '@devhub/shared'
import { resolveGroupStatus } from './group-status'

const mockGroup: Group = {
  id: 'group-1',
  name: '测试任务',
  mode: 'parallel',
  steps: [
    {
      id: 'step-1',
      projectId: 'proj-1',
      scriptId: 'npm:dev',
      continueWhen: { type: 'delay', seconds: 0 }
    },
    {
      id: 'step-2',
      projectId: 'proj-1',
      scriptId: 'npm:api',
      continueWhen: { type: 'delay', seconds: 0 }
    }
  ]
}

const mockFinishedTime = '2026-11-22T12:30:00.000Z'
const formatMockTime = (): string => '12:30'

describe('resolveGroupStatus', () => {
  it('returns idle presentation when group has never been executed', () => {
    const result = resolveGroupStatus({
      group: mockGroup,
      state: undefined,
      active: undefined
    })

    expect(result).toMatchObject({
      phase: 'idle',
      isActive: false,
      badgeText: '并行',
      dotState: 'idle',
      summaryText: '未运行',
      detailBadgeText: '尚未执行',
      progressHint: '待执行'
    })
  })

  it('presents starting status while scheduler is orchestrating steps', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'running',
      steps: [
        { stepId: 'step-1', state: 'done', runId: 'run-1' },
        { stepId: 'step-2', state: 'running', runId: 'run-2' }
      ]
    }
    const active: ActiveGroup = {
      groupId: mockGroup.id,
      phase: 'starting',
      current: 1,
      total: 2,
      runIds: ['run-1', 'run-2']
    }

    const result = resolveGroupStatus({
      group: mockGroup,
      state,
      active
    })

    expect(result).toMatchObject({
      phase: 'starting',
      isActive: true,
      badgeText: '启动中',
      dotState: 'starting',
      summaryText: '启动中',
      detailBadgeText: '第 2 / 2 步 · 启动中',
      progressHint: '正在执行第 2 步'
    })
  })

  it('presents running status with alive script count when execution is done but child runs are still alive', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'done',
      finishedAt: mockFinishedTime,
      steps: [
        { stepId: 'step-1', state: 'done', runId: 'run-1' },
        { stepId: 'step-2', state: 'done', runId: 'run-2' }
      ]
    }
    const active: ActiveGroup = {
      groupId: mockGroup.id,
      phase: 'running',
      current: 2,
      total: 2,
      runIds: ['run-1', 'run-2']
    }

    const result = resolveGroupStatus({
      group: mockGroup,
      state,
      active,
      formatFinished: formatMockTime
    })

    expect(result).toMatchObject({
      phase: 'running',
      isActive: true,
      badgeText: '运行中 2/2',
      dotState: 'running',
      summaryText: '2/2 个脚本运行中',
      detailBadgeText: '运行中 · 2/2 个服务存活',
      progressHint: '全部步骤就绪 · 2 个服务运行中'
    })
  })

  it('presents done status when execution is done and all child runs have exited', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'done',
      finishedAt: mockFinishedTime,
      steps: [
        { stepId: 'step-1', state: 'done', runId: 'run-1' },
        { stepId: 'step-2', state: 'done', runId: 'run-2' }
      ]
    }

    const result = resolveGroupStatus({
      group: mockGroup,
      state,
      active: undefined,
      formatFinished: formatMockTime
    })

    expect(result).toMatchObject({
      phase: 'done',
      isActive: false,
      badgeText: '已完成',
      dotState: 'done',
      summaryText: '已完成 · 12:30',
      detailBadgeText: '已完成',
      progressHint: '全部步骤已完成'
    })
  })

  it('presents failed status when execution failed', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'failed',
      steps: [
        { stepId: 'step-1', state: 'done', runId: 'run-1' },
        { stepId: 'step-2', state: 'failed', message: '端口 8080 被占用' }
      ]
    }

    const result = resolveGroupStatus({
      group: mockGroup,
      state,
      active: undefined
    })

    expect(result).toMatchObject({
      phase: 'failed',
      isActive: false,
      badgeText: '失败',
      dotState: 'failed',
      summaryText: '端口 8080 被占用',
      detailBadgeText: '失败',
      progressHint: '执行中断'
    })
  })

  it('presents ready status when persistent steps are ready without active run data', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'ready',
      finishedAt: mockFinishedTime,
      steps: [
        { stepId: 'step-1', state: 'ready', runId: 'run-1' },
        { stepId: 'step-2', state: 'completed', runId: 'run-2' }
      ]
    }

    const result = resolveGroupStatus({ group: mockGroup, state, active: undefined })

    expect(result).toMatchObject({
      phase: 'ready',
      isActive: true,
      badgeText: '已就绪',
      dotState: 'running',
      summaryText: '启动流程已完成',
      detailBadgeText: '已就绪',
      progressHint: '全部步骤就绪'
    })
  })

  it('presents stopped status when execution was stopped', () => {
    const state: GroupRunState = {
      groupId: mockGroup.id,
      status: 'stopped',
      finishedAt: mockFinishedTime,
      steps: [{ stepId: 'step-1', state: 'cancelled' }]
    }

    const result = resolveGroupStatus({
      group: mockGroup,
      state,
      active: undefined,
      formatFinished: formatMockTime
    })

    expect(result).toMatchObject({
      phase: 'stopped',
      isActive: false,
      badgeText: '已停止',
      dotState: 'done',
      summaryText: '已停止 · 12:30',
      detailBadgeText: '已停止',
      progressHint: '已停止'
    })
  })
})
