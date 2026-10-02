import type { ContinueCondition, DevhubEvent, Run } from '@devhub/shared'
import { stripAnsi } from '../text/ansi'

export interface ConditionDeps {
  subscribe: (listener: (event: DevhubEvent) => void) => () => void
  getRun: (runId: string) => Run | undefined
  /** Recent raw output of the run (ANSI codes included). */
  getOutput: (runId: string) => string
  /** True when something accepts TCP connections on this local port. */
  checkPort: (port: number) => Promise<boolean>
  /** True when a GET to the URL answers 2xx. */
  checkHttp: (url: string) => Promise<boolean>
}

/** Thrown when a wait is cancelled (the group was stopped), as opposed to failing. */
export class WaitCancelledError extends Error {
  constructor() {
    super('已取消')
    this.name = 'WaitCancelledError'
  }
}

export function describeCondition(condition: ContinueCondition): string {
  switch (condition.type) {
    case 'exit':
      return '等待进程成功退出'
    case 'output':
      return condition.regex ? `等待输出匹配 /${condition.text}/` : `等待输出「${condition.text}」`
    case 'port':
      return `等待端口 ${condition.port} 可连接`
    case 'http':
      return `等待 ${condition.url} 返回成功`
    case 'delay':
      return `等待 ${condition.seconds} 秒`
  }
}

const pollMs = 500
// Keep enough recent output to match text split across chunks without growing forever.
const outputTailLimit = 64 * 1024

/**
 * Resolves when the run satisfies the condition; rejects with a user-facing message when it
 * cannot any more (timeout, unexpected exit) or with WaitCancelledError when aborted.
 */
export function waitForCondition(
  condition: ContinueCondition,
  runId: string,
  deps: ConditionDeps,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanups: (() => void)[] = []
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      for (const cleanup of cleanups) cleanup()
      if (error) reject(error)
      else resolve()
    }

    if (signal.aborted) return finish(new WaitCancelledError())
    const onAbort = (): void => finish(new WaitCancelledError())
    signal.addEventListener('abort', onAbort)
    cleanups.push(() => signal.removeEventListener('abort', onAbort))

    if (condition.type === 'delay') {
      const timer = setTimeout(() => finish(), condition.seconds * 1000)
      cleanups.push(() => clearTimeout(timer))
      return
    }

    const timeout = setTimeout(
      () => finish(new Error(`等待超时（${condition.timeoutSeconds} 秒）`)),
      condition.timeoutSeconds * 1000
    )
    cleanups.push(() => clearTimeout(timeout))

    /** An exit settles every condition: success for `exit` with code 0, failure otherwise. */
    const onExited = (run: Run): void => {
      if (condition.type === 'exit' && run.exitCode === 0) finish()
      else if (condition.type === 'exit') finish(new Error(`进程退出码 ${run.exitCode ?? '未知'}`))
      else finish(new Error('进程已退出，条件未满足'))
    }

    let outputTail = deps.getOutput(runId).slice(-outputTailLimit)
    // Validated when the group was saved; compiled once per wait.
    const pattern =
      condition.type === 'output' && condition.regex ? new RegExp(condition.text) : null
    const outputMatches = (): boolean => {
      if (condition.type !== 'output') return false
      const text = stripAnsi(outputTail)
      return pattern ? pattern.test(text) : text.includes(condition.text)
    }

    const unsubscribe = deps.subscribe((event) => {
      if (event.type === 'run-output' && event.runId === runId && condition.type === 'output') {
        outputTail = (outputTail + event.data).slice(-outputTailLimit)
        if (outputMatches()) finish()
      } else if (event.type === 'run-updated' && event.run.id === runId) {
        if (event.run.status === 'exited') onExited(event.run)
      }
    })
    cleanups.push(unsubscribe)

    // The run may already be past the point we are waiting for.
    if (outputMatches()) return finish()
    const current = deps.getRun(runId)
    if (current?.status === 'exited') return onExited(current)

    if (condition.type === 'port' || condition.type === 'http') {
      const check =
        condition.type === 'port'
          ? () => deps.checkPort(condition.port)
          : () => deps.checkHttp(condition.url)
      let timer: ReturnType<typeof setTimeout> | undefined
      const poll = async (): Promise<void> => {
        const open = await check().catch(() => false)
        if (open) finish()
        else if (!settled) timer = setTimeout(() => void poll(), pollMs)
      }
      cleanups.push(() => clearTimeout(timer))
      void poll()
    }
  })
}
