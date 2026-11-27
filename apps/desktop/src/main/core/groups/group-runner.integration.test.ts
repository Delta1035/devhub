import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type DevhubEvent, type Group, type GroupRunState } from '@devhub/shared'
import { createHarness } from '../process/__tests__/fixtures'
import type { RunManager } from '../process/run-manager'
import { createGroupRunner } from './group-runner'

describe('group runner with RunManager', () => {
  let manager: RunManager | undefined

  beforeEach(() => vi.useFakeTimers())

  afterEach(async () => {
    await manager?.dispose()
    vi.useRealTimers()
  })

  it('follows real run output and exit events through the public manager API', async () => {
    const listeners: ((event: DevhubEvent) => void)[] = []
    const states: GroupRunState[] = []
    const emit = (event: DevhubEvent): void => {
      if (event.type === 'group-updated') states.push(event.state)
      for (const listener of listeners) listener(event)
    }
    const harness = createHarness()
    const runManager = harness.makeManager({ emit, outputLimit: 1024 })
    manager = runManager
    const group: Group = {
      id: 'g',
      name: 'build and serve',
      mode: 'parallel',
      steps: [
        {
          id: 'build',
          projectId: 'p1',
          scriptId: 'npm:api',
          executionKind: 'oneShot',
          continueWhen: { type: 'exit', timeoutSeconds: 30 }
        },
        {
          id: 'serve',
          projectId: 'p1',
          scriptId: 'npm:dev',
          executionKind: 'persistent',
          continueWhen: { type: 'output', text: 'ready', timeoutSeconds: 30 }
        }
      ]
    }
    const runner = createGroupRunner({
      groups: {
        async get(id) {
          if (id !== group.id) throw new DevhubError('GROUP_NOT_FOUND', '批量任务不存在')
          return group
        }
      },
      runs: runManager,
      subscribe(listener) {
        listeners.push(listener)
        return () => {
          const index = listeners.indexOf(listener)
          if (index !== -1) listeners.splice(index, 1)
        }
      },
      checkPort: async () => false,
      checkHttp: async () => false,
      emit
    })

    await runner.start(group.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.ptys).toHaveLength(2)

    harness.ptys[0]?.emitExit(0)
    harness.ptys[1]?.emitData('server ready')
    await vi.advanceTimersByTimeAsync(16)
    expect(states.at(-1)).toMatchObject({
      status: 'ready',
      steps: [{ state: 'completed' }, { state: 'ready' }]
    })

    harness.ptys[1]?.emitExit(2)
    expect(states.at(-1)).toMatchObject({
      status: 'failed',
      steps: [
        { state: 'completed' },
        { state: 'failed', message: '持续运行任务异常退出（退出码 2）' }
      ]
    })
  })
})
