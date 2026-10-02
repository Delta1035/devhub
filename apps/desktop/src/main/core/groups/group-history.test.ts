import { describe, expect, it, vi } from 'vitest'
import { DevhubError, type Group, type GroupRunState } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import {
  createGroupHistory,
  emptyGroupHistoryFile,
  settleInterrupted,
  type GroupHistoryFile
} from './group-history'
import { createGroupRunner } from './group-runner'

const at = new Date('2026-10-02T10:32:00.000Z')

const memoryStore = (initial: GroupHistoryFile = emptyGroupHistoryFile()) => {
  let saved = structuredClone(initial)
  const store: JsonStore<GroupHistoryFile> & { saved: () => GroupHistoryFile } = {
    read: async () => structuredClone(saved),
    write: async (value) => {
      saved = structuredClone(value)
    },
    saved: () => saved
  }
  return store
}

describe('settleInterrupted', () => {
  it('turns a state left "running" by a crash into a stopped one', () => {
    const state: GroupRunState = {
      groupId: 'g',
      status: 'running',
      steps: [
        { stepId: 's1', state: 'done', runId: 'r1' },
        { stepId: 's2', state: 'running', runId: 'r2', message: '等待输出「ready」' },
        { stepId: 's3', state: 'pending' }
      ]
    }
    expect(settleInterrupted(state, at)).toEqual({
      groupId: 'g',
      status: 'stopped',
      finishedAt: at.toISOString(),
      steps: [
        { stepId: 's1', state: 'done', runId: 'r1' },
        { stepId: 's2', state: 'cancelled', runId: 'r2' },
        { stepId: 's3', state: 'cancelled' }
      ]
    })
  })

  it('leaves finished states alone', () => {
    const state: GroupRunState = { groupId: 'g', status: 'failed', steps: [] }
    expect(settleInterrupted(state, at)).toBe(state)
  })
})

describe('group runner with history', () => {
  const group: Group = {
    id: 'g',
    name: 'nightly',
    mode: 'parallel',
    steps: [
      { id: 's1', projectId: 'p1', scriptId: 'npm:a', continueWhen: { type: 'delay', seconds: 0 } }
    ]
  }

  const makeRunner = (store: ReturnType<typeof memoryStore>) =>
    createGroupRunner({
      groups: {
        get: async (id) => {
          if (id !== 'g') throw new DevhubError('GROUP_NOT_FOUND', '批量任务不存在或已被删除')
          return group
        }
      },
      runs: {
        start: vi.fn(async () => {
          throw new DevhubError('SCRIPT_NOT_FOUND', '脚本不存在')
        }),
        stop: vi.fn(async () => undefined),
        list: () => [],
        output: () => ({ data: '', end: 0 })
      },
      subscribe: () => () => undefined,
      checkPort: async () => false,
      emit: () => undefined,
      history: createGroupHistory(store, () => at),
      now: () => at
    })

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('saves a finished result with its time and restores it in the next session', async () => {
    const store = memoryStore()
    const first = makeRunner(store)
    await first.start('g')
    await settle()
    expect(store.saved().states).toEqual([
      {
        groupId: 'g',
        status: 'failed',
        finishedAt: at.toISOString(),
        steps: [{ stepId: 's1', state: 'failed', message: '脚本不存在' }]
      }
    ])

    const next = makeRunner(store)
    await expect(next.states()).resolves.toEqual(store.saved().states)
  })

  it('forgets a deleted group', async () => {
    const store = memoryStore({
      version: 1,
      states: [{ groupId: 'g', status: 'done', finishedAt: at.toISOString(), steps: [] }]
    })
    const runner = makeRunner(store)
    await runner.forget('g')
    await settle()
    await expect(runner.states()).resolves.toEqual([])
    expect(store.saved().states).toEqual([])
  })
})
