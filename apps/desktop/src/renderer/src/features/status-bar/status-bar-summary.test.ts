import { describe, expect, it } from 'vitest'
import type { Project, Run, RunHealth } from '@devhub/shared'
import { buildStatusBarSummary, parseHealthTarget } from './status-bar-summary'

function makeProject(id: string, name: string): Project {
  return {
    id,
    name,
    path: `/workspace/${name}`,
    addedAt: '2026-11-25T00:00:00.000Z'
  }
}

function makeRun(overrides: Partial<Run> & Pick<Run, 'id' | 'projectId' | 'title'>): Run {
  return {
    kind: 'script',
    scriptId: `npm:${overrides.title}`,
    command: `pnpm ${overrides.title}`,
    status: 'running',
    pid: 1000,
    exitCode: null,
    stopped: false,
    startedAt: '2026-11-25T00:00:00.000Z',
    ...overrides
  } as Run
}

describe('parseHealthTarget', () => {
  it('parses port, http, output, alive, and unknown targets accurately', () => {
    expect(parseHealthTarget('端口 4203')).toEqual({
      kind: 'port',
      ports: ['4203'],
      raw: '端口 4203'
    })
    expect(parseHealthTarget('端口 4210, 4211')).toEqual({
      kind: 'port',
      ports: ['4210', '4211'],
      raw: '端口 4210, 4211'
    })
    expect(parseHealthTarget('GET http://localhost:8080/actuator/health')).toEqual({
      kind: 'http',
      ports: ['8080'],
      raw: 'GET http://localhost:8080/actuator/health'
    })
    expect(parseHealthTarget('输出包含「listening」')).toEqual({
      kind: 'output',
      ports: [],
      raw: '输出包含「listening」'
    })
    expect(parseHealthTarget('进程稳定运行')).toEqual({
      kind: 'alive',
      ports: [],
      raw: '进程稳定运行'
    })
    expect(parseHealthTarget('custom check')).toEqual({
      kind: 'other',
      ports: [],
      raw: 'custom check'
    })
  })
})

describe('buildStatusBarSummary', () => {
  it('deduplicates ready ports, collapses overflow, and avoids repeating alive labels', () => {
    const projects = [makeProject('p1', 'admin-web'), makeProject('p2', 'gateway-api')]
    const runs: Run[] = [
      makeRun({ id: 'r1', projectId: 'p1', title: 'dev:web', pid: 101 }),
      makeRun({ id: 'r2', projectId: 'p1', title: 'dev:docs', pid: 102 }),
      makeRun({ id: 'r3', projectId: 'p2', title: 'serve:api', pid: 103 }),
      makeRun({ id: 'r4', projectId: 'p2', title: 'serve:ws', pid: 104 }),
      makeRun({ id: 'r5', projectId: 'p2', title: 'worker:sync', pid: 105 }),
      makeRun({ id: 'r6', projectId: 'p1', title: 'worker:lint', pid: 106 }),
      makeRun({ id: 'r7', projectId: 'p1', title: 'worker:css', pid: 107 })
    ]
    const health: RunHealth[] = [
      { runId: 'r1', state: 'ready', target: '端口 4213', since: '2026-11-25T00:00:02.000Z' },
      {
        runId: 'r2',
        state: 'ready',
        target: 'GET http://localhost:4203/health',
        since: '2026-11-25T00:00:02.000Z'
      },
      { runId: 'r3', state: 'ready', target: '端口 4210, 4211', since: '2026-11-25T00:00:02.000Z' },
      { runId: 'r4', state: 'ready', target: '端口 4210', since: '2026-11-25T00:00:02.000Z' },
      { runId: 'r5', state: 'ready', target: '进程稳定运行', since: '2026-11-25T00:00:02.000Z' },
      { runId: 'r6', state: 'ready', target: '进程稳定运行', since: '2026-11-25T00:00:02.000Z' },
      {
        runId: 'r7',
        state: 'starting',
        target: '输出包含「ready」',
        since: '2026-11-25T00:00:01.000Z'
      }
    ]

    const summary = buildStatusBarSummary({ runs, health, projects })

    expect(summary.activeCount).toBe(7)
    expect(summary.readyPorts).toEqual(['4203', '4210', '4211', '4213'])
    expect(summary.visiblePorts).toEqual(['4203', '4210', '4211'])
    expect(summary.overflowPortCount).toBe(1)
    expect(summary.readyNonPortCount).toBe(2)
    expect(summary.triggerLabel).toBe('端口 4203 · 4210 · 4211 +1 就绪 · 2 项稳定 · 1 启动中')
    // Starting item sorts before ready items, and alive items include concrete project/script/pid metadata.
    expect(summary.healthItems[0]).toMatchObject({
      runId: 'r7',
      state: 'starting',
      projectName: 'admin-web',
      scriptTitle: 'worker:css',
      pid: 107
    })
    const aliveItems = summary.healthItems.filter((item) => item.kind === 'alive')
    expect(aliveItems).toHaveLength(2)
    expect(aliveItems.map((item) => `${item.projectName}:${item.scriptTitle}:${item.pid}`)).toEqual(
      ['admin-web:worker:lint:106', 'gateway-api:worker:sync:105']
    )
  })

  it('summarizes alive-only runs cleanly without repeating target string', () => {
    const projects = [makeProject('p1', 'core')]
    const runs = [
      makeRun({ id: 'r1', projectId: 'p1', title: 'watch-a', pid: 201 }),
      makeRun({ id: 'r2', projectId: 'p1', title: 'watch-b', pid: 202 })
    ]
    const health: RunHealth[] = [
      { runId: 'r1', state: 'ready', target: '进程稳定运行', since: '2026-11-25T00:00:02.000Z' },
      { runId: 'r2', state: 'ready', target: '进程稳定运行', since: '2026-11-25T00:00:02.000Z' }
    ]

    const summary = buildStatusBarSummary({ runs, health, projects })
    expect(summary.triggerLabel).toBe('2 项稳定运行')
    expect(summary.healthItems.map((i) => i.scriptTitle)).toEqual(['watch-a', 'watch-b'])
  })

  it('prioritizes unhealthy items in both trigger label and sorted detail list', () => {
    const projects = [makeProject('p1', 'web'), makeProject('p2', 'api')]
    const runs = [
      makeRun({ id: 'r1', projectId: 'p1', title: 'dev', pid: 301 }),
      makeRun({ id: 'r2', projectId: 'p2', title: 'server', pid: 302 })
    ]
    const health: RunHealth[] = [
      { runId: 'r1', state: 'ready', target: '端口 3000', since: '2026-11-25T00:00:02.000Z' },
      { runId: 'r2', state: 'unhealthy', target: '进程稳定运行', since: '2026-11-25T00:00:05.000Z' }
    ]

    const summary = buildStatusBarSummary({ runs, health, projects })
    expect(summary.counts).toEqual({ total: 2, ready: 1, starting: 0, unhealthy: 1 })
    expect(summary.triggerLabel).toBe('1 个无响应 · 端口 3000')
    expect(summary.healthItems.map((item) => item.runId)).toEqual(['r2', 'r1'])
  })

  it('picks the latest unexpected failure and ignores exited runs in health items', () => {
    const projects = [makeProject('p1', 'pkg')]
    const runs = [
      makeRun({
        id: 'r-old',
        projectId: 'p1',
        title: 'old-fail',
        status: 'exited',
        exitCode: 1,
        endedAt: '2026-11-25T00:01:00.000Z'
      }),
      makeRun({
        id: 'r-stopped',
        projectId: 'p1',
        title: 'manual-stop',
        status: 'exited',
        stopped: true,
        exitCode: 1,
        endedAt: '2026-11-25T00:03:00.000Z'
      }),
      makeRun({
        id: 'r-new',
        projectId: 'p1',
        title: 'publish:local:jinzhu',
        status: 'exited',
        exitCode: 2,
        endedAt: '2026-11-25T00:02:00.000Z'
      })
    ]
    const health: RunHealth[] = [
      { runId: 'r-new', state: 'ready', target: '进程稳定运行', since: '2026-11-25T00:00:02.000Z' }
    ]

    const summary = buildStatusBarSummary({ runs, health, projects })
    expect(summary.activeCount).toBe(0)
    expect(summary.failedRun?.id).toBe('r-new')
    expect(summary.failedProjectName).toBe('pkg')
    expect(summary.healthItems).toHaveLength(0)
    expect(summary.triggerLabel).toBe('')
  })
})
