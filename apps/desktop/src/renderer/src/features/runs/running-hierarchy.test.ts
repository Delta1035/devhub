import { describe, expect, it } from 'vitest'
import type { GroupRunState, Project, Run, RunHealth } from '@devhub/shared'
import type { ActiveGroupView } from '@renderer/features/groups/use-active-groups'
import { buildRunningHierarchy, countSidebarRunningBadge } from './running-hierarchy'

const makeProject = (id: string, name: string): Project => ({
  id,
  name,
  path: `/workspace/${name}`,
  addedAt: '2026-11-01T00:00:00.000Z'
})

const makeRun = (
  id: string,
  projectId: string,
  title: string,
  status: Run['status'] = 'running'
): Run => ({
  id,
  kind: 'script',
  projectId,
  scriptId: `npm:${title}`,
  title,
  command: `npm run ${title}`,
  status,
  pid: 100,
  exitCode: null,
  stopped: false,
  startedAt: '2026-11-01T00:00:00.000Z'
})

describe('buildRunningHierarchy', () => {
  const projects = [makeProject('p1', 'api'), makeProject('p2', 'web'), makeProject('p3', 'admin')]

  it('groups child runs under their parent batch group and separates standalone runs', () => {
    const runApi = makeRun('r1', 'p1', 'serve')
    const runWeb = makeRun('r2', 'p2', 'dev')
    const runAdmin = makeRun('r3', 'p3', 'lint')
    const activeGroups: ActiveGroupView[] = [
      {
        groupId: 'g1',
        name: '前后端联调',
        phase: 'running',
        current: 2,
        total: 2,
        runIds: ['r1', 'r2']
      }
    ]
    const groupStates: GroupRunState[] = [
      {
        groupId: 'g1',
        status: 'done',
        group: { id: 'g1', name: '前后端联调', mode: 'serial', steps: [] },
        steps: [
          { stepId: 's1', state: 'done', runId: 'r1' },
          { stepId: 's2', state: 'done', runId: 'r2', reused: true }
        ]
      }
    ]
    const health: RunHealth[] = [
      { runId: 'r1', state: 'ready', target: '端口 3000', since: '2026-11-01T00:00:05.000Z' }
    ]

    const result = buildRunningHierarchy({
      activeGroups,
      groupStates,
      activeRuns: [runApi, runWeb, runAdmin],
      projects,
      health
    })

    expect(result.hasActive).toBe(true)
    expect(result.activeRunCount).toBe(3)
    expect(result.activeGroupCount).toBe(1)
    expect(result.subtitle).toBe('3 个活动项运行中（含 1 个批量任务、1 个独立运行）')
    expect(result.groupNodes).toHaveLength(1)
    expect(result.groupNodes[0]).toMatchObject({
      mode: 'serial',
      waitingMessage: null
    })
    expect(result.groupNodes[0]?.children).toEqual([
      {
        run: runApi,
        projectName: 'api',
        health: {
          runId: 'r1',
          state: 'ready',
          target: '端口 3000',
          since: '2026-11-01T00:00:05.000Z'
        },
        stepNumbers: [1],
        reused: false,
        sharedWithGroupNames: []
      },
      {
        run: runWeb,
        projectName: 'web',
        health: undefined,
        stepNumbers: [2],
        reused: true,
        sharedWithGroupNames: []
      }
    ])
    expect(result.standaloneRuns).toEqual([
      {
        run: runAdmin,
        projectName: 'admin',
        health: undefined
      }
    ])
  })

  it('tracks shared runs across multiple active batch groups without losing parent-child links', () => {
    const runApi = makeRun('r1', 'p1', 'serve')
    const runWeb = makeRun('r2', 'p2', 'dev')
    const activeGroups: ActiveGroupView[] = [
      {
        groupId: 'g1',
        name: '后端+Web',
        phase: 'running',
        current: 2,
        total: 2,
        runIds: ['r1', 'r2']
      },
      { groupId: 'g2', name: '全栈调试', phase: 'running', current: 1, total: 1, runIds: ['r1'] }
    ]
    const groupStates: GroupRunState[] = [
      {
        groupId: 'g1',
        status: 'done',
        steps: [
          { stepId: 's1', state: 'done', runId: 'r1' },
          { stepId: 's2', state: 'done', runId: 'r2' }
        ]
      },
      {
        groupId: 'g2',
        status: 'done',
        steps: [{ stepId: 's3', state: 'done', runId: 'r1', reused: true }]
      }
    ]

    const result = buildRunningHierarchy({
      activeGroups,
      groupStates,
      activeRuns: [runApi, runWeb],
      projects
    })

    expect(result.standaloneRuns).toHaveLength(0)
    expect(result.subtitle).toBe('2 个子任务运行中 · 关联 2 个批量任务')
    expect(result.groupNodes[0]?.children[0]?.sharedWithGroupNames).toEqual(['全栈调试'])
    expect(result.groupNodes[0]?.children[1]?.sharedWithGroupNames).toEqual([])
    expect(result.groupNodes[1]?.children[0]?.sharedWithGroupNames).toEqual(['后端+Web'])
    expect(result.groupNodes[1]?.children[0]?.reused).toBe(true)
  })

  it('exposes waiting message for starting batch group even before child runs spawn', () => {
    const activeGroups: ActiveGroupView[] = [
      { groupId: 'g1', name: '串行启动', phase: 'starting', current: 0, total: 2, runIds: [] }
    ]
    const groupStates: GroupRunState[] = [
      {
        groupId: 'g1',
        status: 'running',
        steps: [
          { stepId: 's1', state: 'running', message: '等待输出 "API ready"' },
          { stepId: 's2', state: 'pending' }
        ]
      }
    ]

    const result = buildRunningHierarchy({
      activeGroups,
      groupStates,
      activeRuns: [],
      projects
    })

    expect(result.hasActive).toBe(true)
    expect(result.subtitle).toBe('1 个批量任务正在启动')
    expect(result.groupNodes[0]?.children).toEqual([])
    expect(result.groupNodes[0]?.waitingMessage).toBe('等待输出 "API ready"')
  })

  it('merges duplicate step references to the same run within one batch group', () => {
    const runApi = makeRun('r1', 'p1', 'serve')
    const activeGroups: ActiveGroupView[] = [
      { groupId: 'g1', name: '重复引用', phase: 'running', current: 1, total: 2, runIds: ['r1'] }
    ]
    const groupStates: GroupRunState[] = [
      {
        groupId: 'g1',
        status: 'done',
        steps: [
          { stepId: 's1', state: 'done', runId: 'r1' },
          { stepId: 's2', state: 'done', runId: 'r1', reused: true }
        ]
      }
    ]

    const result = buildRunningHierarchy({
      activeGroups,
      groupStates,
      activeRuns: [runApi],
      projects
    })

    expect(result.groupNodes[0]?.children).toHaveLength(1)
    expect(result.groupNodes[0]?.children[0]?.stepNumbers).toEqual([1, 2])
    expect(result.groupNodes[0]?.children[0]?.reused).toBe(true)
  })
})

describe('countSidebarRunningBadge', () => {
  it('counts active runs without double-counting parent batch groups', () => {
    const runs = [makeRun('r1', 'p1', 'serve'), makeRun('r2', 'p2', 'dev')]
    const groups: ActiveGroupView[] = [
      { groupId: 'g1', name: '联调', phase: 'running', current: 2, total: 2, runIds: ['r1', 'r2'] }
    ]
    expect(countSidebarRunningBadge(runs, groups)).toBe(2)
  })

  it('counts a starting batch group that has not spawned any active run yet', () => {
    const groups: ActiveGroupView[] = [
      { groupId: 'g1', name: '启动中任务', phase: 'starting', current: 0, total: 2, runIds: [] }
    ]
    expect(countSidebarRunningBadge([], groups)).toBe(1)
  })

  it('returns 0 when nothing is running', () => {
    expect(countSidebarRunningBadge([makeRun('r1', 'p1', 'serve', 'exited')], [])).toBe(0)
  })
})
