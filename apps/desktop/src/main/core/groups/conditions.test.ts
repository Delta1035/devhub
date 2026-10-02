import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContinueCondition, DevhubEvent, Run } from '@devhub/shared'
import { waitForCondition, type ConditionDeps } from './conditions'

type ScriptRun = Extract<Run, { kind: 'script' }>

const run = (overrides: Partial<ScriptRun> = {}): ScriptRun => ({
  id: 'r1',
  projectId: 'p1',
  kind: 'script',
  scriptId: 'npm:dev',
  title: 'dev',
  command: 'pnpm run dev',
  status: 'running',
  pid: 1,
  exitCode: null,
  stopped: false,
  startedAt: '2026-10-02T00:00:00.000Z',
  ...overrides
})

describe('waitForCondition', () => {
  let listeners: ((event: DevhubEvent) => void)[]
  let current: Run
  let output: string
  let portOpen: boolean
  let controller: AbortController

  beforeEach(() => {
    vi.useFakeTimers()
    listeners = []
    current = run()
    output = ''
    portOpen = false
    controller = new AbortController()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const deps: ConditionDeps = {
    subscribe: (listener) => {
      listeners.push(listener)
      return () => (listeners = listeners.filter((l) => l !== listener))
    },
    getRun: () => current,
    getOutput: () => output,
    checkPort: async () => portOpen
  }
  const emit = (event: DevhubEvent): void => listeners.forEach((listener) => listener(event))
  const exit = (exitCode: number): void => {
    current = run({ status: 'exited', exitCode })
    emit({ type: 'run-updated', run: current })
  }
  const wait = (condition: ContinueCondition) =>
    waitForCondition(condition, 'r1', deps, controller.signal)
  /** Attaches a handler right away so a later rejection is never "unhandled". */
  const settle = (promise: Promise<void>) =>
    promise.then(
      () => 'ok',
      (error: Error) => error.message
    )

  it('waits for text in the output, ignoring colors and chunk boundaries', async () => {
    const result = settle(wait({ type: 'output', text: 'ready in', timeoutSeconds: 10 }))
    emit({ type: 'run-output', runId: 'r1', offset: 0, data: '\x1b[32mVITE\x1b[0m rea' })
    emit({ type: 'run-output', runId: 'other', offset: 0, data: 'ready in' })
    emit({ type: 'run-output', runId: 'r1', offset: 20, data: 'dy \x1b[1min\x1b[0m 300ms' })
    await expect(result).resolves.toBe('ok')
    expect(listeners).toEqual([])
  })

  it('matches a regular expression against colorless output', async () => {
    const result = settle(
      wait({ type: 'output', text: 'Started \\w+ in [\\d.]+ s', regex: true, timeoutSeconds: 10 })
    )
    emit({ type: 'run-output', runId: 'r1', offset: 0, data: 'Started (ignored)\n' })
    emit({
      type: 'run-output',
      runId: 'r1',
      offset: 0,
      data: '\x1b[32mStarted Api\x1b[0m in 3.2 s'
    })
    await expect(result).resolves.toBe('ok')
  })

  it('succeeds at once when the text was already printed', async () => {
    output = 'Started Application in 3.2s'
    await expect(
      settle(wait({ type: 'output', text: 'Started', timeoutSeconds: 10 }))
    ).resolves.toBe('ok')
  })

  it('fails when the process exits before printing the text', async () => {
    const result = settle(wait({ type: 'output', text: 'ready', timeoutSeconds: 10 }))
    exit(1)
    await expect(result).resolves.toBe('进程已退出，条件未满足')
  })

  it('times out', async () => {
    const result = settle(wait({ type: 'output', text: 'ready', timeoutSeconds: 5 }))
    await vi.advanceTimersByTimeAsync(5000)
    await expect(result).resolves.toBe('等待超时（5 秒）')
    expect(listeners).toEqual([])
  })

  it.each([
    [0, 'ok'],
    [2, '进程退出码 2']
  ])('waits for an exit and checks its code (%s)', async (code, expected) => {
    const result = settle(wait({ type: 'exit', timeoutSeconds: 10 }))
    exit(code)
    await expect(result).resolves.toBe(expected)
  })

  it('evaluates an exit that already happened', async () => {
    current = run({ status: 'exited', exitCode: 0 })
    await expect(settle(wait({ type: 'exit', timeoutSeconds: 10 }))).resolves.toBe('ok')
  })

  it('polls the port until it accepts connections', async () => {
    const result = settle(wait({ type: 'port', port: 8080, timeoutSeconds: 10 }))
    await vi.advanceTimersByTimeAsync(1500)
    portOpen = true
    await vi.advanceTimersByTimeAsync(500)
    await expect(result).resolves.toBe('ok')
  })

  it('waits a fixed delay', async () => {
    const result = settle(wait({ type: 'delay', seconds: 3 }))
    await vi.advanceTimersByTimeAsync(2999)
    let done = false
    void result.then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok')
  })

  it('is cancelled by the abort signal', async () => {
    const result = settle(wait({ type: 'port', port: 8080, timeoutSeconds: 10 }))
    controller.abort()
    await expect(result).resolves.toBe('已取消')
    expect(listeners).toEqual([])
  })
})
