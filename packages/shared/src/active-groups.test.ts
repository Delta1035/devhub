import { describe, expect, it } from 'vitest'
import { activeGroups } from './active-groups'
import type { Run } from './domain'
import type { GroupRunState, GroupStepState } from './groups'

const run = (id: string, status: Run['status'] = 'running'): Run => ({
  id,
  kind: 'script',
  projectId: 'p',
  scriptId: `npm:${id}`,
  title: id,
  command: `npm run ${id}`,
  status,
  pid: 1,
  exitCode: null,
  stopped: false,
  startedAt: '2026-10-09T00:00:00.000Z'
})

const state = (
  status: GroupRunState['status'],
  steps: { state: GroupStepState; runId?: string }[]
): GroupRunState => ({
  groupId: 'g',
  status,
  steps: steps.map((step, index) => ({ stepId: `s${index}`, ...step }))
})

describe('activeGroups', () => {
  it('reports an execution in progress with the steps done so far', () => {
    const states = [
      state('running', [
        { state: 'done', runId: 'a' },
        { state: 'running', runId: 'b' },
        { state: 'pending' }
      ])
    ]
    expect(activeGroups(states, [run('a'), run('b')])).toEqual([
      { groupId: 'g', phase: 'starting', current: 1, total: 3, runIds: ['a', 'b'] }
    ])
  })

  it('keeps an ended execution active while its scripts run', () => {
    const states = [
      state('done', [
        { state: 'done', runId: 'a' },
        { state: 'done', runId: 'b' }
      ])
    ]
    expect(activeGroups(states, [run('a'), run('b', 'exited')])).toEqual([
      { groupId: 'g', phase: 'running', current: 1, total: 2, runIds: ['a'] }
    ])
  })

  it('counts a stopping script as still alive', () => {
    const states = [state('stopped', [{ state: 'done', runId: 'a' }])]
    expect(activeGroups(states, [run('a', 'stopping')])).toHaveLength(1)
  })

  it('drops a group once all its scripts exited', () => {
    const states = [state('failed', [{ state: 'done', runId: 'a' }, { state: 'failed' }])]
    expect(activeGroups(states, [run('a', 'exited')])).toEqual([])
    expect(activeGroups(states, [])).toEqual([])
  })

  it('includes reused runs, counting a run shared by two steps once', () => {
    const states = [
      state('done', [
        { state: 'done', runId: 'a' },
        { state: 'done', runId: 'a' }
      ])
    ]
    expect(activeGroups(states, [run('a')])[0]).toMatchObject({ current: 1, runIds: ['a'] })
  })

  it('ignores older results without run ids', () => {
    expect(activeGroups([state('done', [{ state: 'done' }])], [run('a')])).toEqual([])
  })
})
