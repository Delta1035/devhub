import { describe, expect, it } from 'vitest'
import type { Run } from '@devhub/shared'
import { activeProjectIds, describeRun, runsByScript } from './run-status'

function scriptRun(patch: Partial<Run> & { scriptId?: string } = {}): Run {
  return {
    id: 'r1',
    projectId: 'p1',
    title: 'dev',
    command: 'pnpm dev',
    status: 'running',
    pid: 1,
    exitCode: null,
    stopped: false,
    startedAt: '2026-10-06T00:00:00.000Z',
    kind: 'script',
    scriptId: 'npm:dev',
    ...patch
  } as Run
}

describe('describeRun', () => {
  it('names every state', () => {
    expect(describeRun(undefined)).toEqual({ label: '未运行', tone: 'idle' })
    expect(describeRun(scriptRun())).toEqual({ label: '运行中', tone: 'running' })
    expect(describeRun(scriptRun({ status: 'stopping' })).tone).toBe('pending')
    expect(describeRun(scriptRun({ status: 'exited', stopped: true, exitCode: 1 }))).toEqual({
      label: '已停止',
      tone: 'idle'
    })
    expect(describeRun(scriptRun({ status: 'exited', exitCode: 0 })).label).toBe('已结束')
    expect(describeRun(scriptRun({ status: 'exited', exitCode: 2 }))).toEqual({
      label: '退出码 2',
      tone: 'failed'
    })
    expect(describeRun(scriptRun({ status: 'exited' })).label).toBe('异常退出')
  })
})

describe('runsByScript / activeProjectIds', () => {
  const runs: Run[] = [
    scriptRun({ id: 'a', scriptId: 'npm:dev' }),
    scriptRun({ id: 'b', projectId: 'p2', status: 'exited', exitCode: 0 }),
    { ...scriptRun({ id: 'c', projectId: 'p3' }), kind: 'shell', shellId: 'bash' } as Run
  ]

  it('indexes script runs of one project', () => {
    expect([...runsByScript(runs, 'p1').keys()]).toEqual(['npm:dev'])
    expect(runsByScript(runs, 'p3').size).toBe(0)
  })

  it('lists projects with running scripts, not shells', () => {
    expect(activeProjectIds(runs)).toEqual(new Set(['p1']))
  })
})
