import {
  DevhubError,
  type DevhubEvent,
  type Group,
  type GroupRunState,
  type GroupStep,
  type GroupStepState,
  type Run
} from '@devhub/shared'
import type { RunManager } from '../process/run-manager'
import { describeCondition, waitForCondition, WaitCancelledError } from './conditions'
import type { GroupHistory } from './group-history'
import type { GroupService } from './group-service'

export interface GroupRunner {
  start(groupId: unknown): Promise<GroupRunState>
  stop(groupId: unknown): Promise<void>
  isRunning(groupId: unknown): Promise<boolean>
  /** Latest state of each group, including results restored from earlier sessions. */
  states(): Promise<GroupRunState[]>
  /** Drops a deleted group's state. */
  forget(groupId: string): Promise<void>
  /** Cancels running sequences (the runs themselves are stopped by the RunManager). */
  dispose(): void
}

export interface GroupRunnerDeps {
  groups: Pick<GroupService, 'get'>
  runs: Pick<RunManager, 'start' | 'stop' | 'list' | 'output'>
  subscribe: (listener: (event: DevhubEvent) => void) => () => void
  checkPort: (port: number) => Promise<boolean>
  checkHttp: (url: string) => Promise<boolean>
  emit: (event: DevhubEvent) => void
  /** Keeps the last result of each group across restarts. */
  history?: GroupHistory
  now?: () => Date
}

interface Execution {
  state: GroupRunState
  controller: AbortController
  /** Why an in-progress sequence was aborted by a persistent run monitor. */
  abortStatus?: 'failed' | 'stopped'
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Starts a group's scripts in parallel, or one by one waiting for each step's condition.
 * A script that is already running is reused rather than started twice.
 */
export function createGroupRunner(deps: GroupRunnerDeps): GroupRunner {
  const { groups, runs, subscribe, checkPort, checkHttp, emit } = deps
  const executions = new Map<string, Execution>()
  const now = deps.now ?? (() => new Date())

  // Results of earlier sessions; an execution in this session replaces its group's entry.
  const restored = new Map<string, GroupRunState>()
  const ready = (deps.history?.load() ?? Promise.resolve([]))
    .then((states) => states.forEach((state) => restored.set(state.groupId, state)))
    .catch((error: unknown) => console.warn('[groups] could not load history', error))

  const latestStates = (): GroupRunState[] => {
    const states = new Map(restored)
    for (const [groupId, execution] of executions) states.set(groupId, execution.state)
    return [...states.values()].map((state) => structuredClone(state))
  }

  const persist = (): void => {
    if (!deps.history) return
    const finished = latestStates().filter((state) => state.status !== 'running')
    deps.history.save(finished).catch((error: unknown) => {
      console.warn('[groups] could not save history', error)
    })
  }

  const activeRunOf = (step: GroupStep): Run | undefined =>
    runs
      .list()
      .find(
        (run) =>
          run.kind === 'script' &&
          run.projectId === step.projectId &&
          run.scriptId === step.scriptId &&
          run.status !== 'exited'
      )

  const publish = (execution: Execution): void =>
    emit({ type: 'group-updated', state: structuredClone(execution.state) })

  const setStep = (
    execution: Execution,
    index: number,
    state: GroupStepState,
    extra: { runId?: string; reused?: boolean; message?: string } = {}
  ): void => {
    const step = execution.state.steps[index]
    if (!step) return
    step.state = state
    if (extra.runId !== undefined) step.runId = extra.runId
    if (extra.reused !== undefined) step.reused = extra.reused
    step.message = extra.message
    publish(execution)
  }

  const finish = (execution: Execution, status: GroupRunState['status']): void => {
    for (const [index, step] of execution.state.steps.entries()) {
      if (step.state === 'pending' || step.state === 'running') {
        execution.state.steps[index] = { ...step, state: 'cancelled', message: undefined }
      }
    }
    execution.state.status = status
    execution.state.finishedAt = now().toISOString()
    publish(execution)
    persist()
  }

  /** Reuses an active run of the script, or starts it. */
  const startStep = async (step: GroupStep): Promise<{ run: Run; reused: boolean }> => {
    const existing = activeRunOf(step)
    if (existing) return { run: existing, reused: true }
    return { run: await runs.start(step.projectId, step.scriptId), reused: false }
  }

  const successStatus = (group: Group): GroupRunState['status'] =>
    group.steps.some((step) => step.executionKind === 'persistent') ? 'ready' : 'done'

  const monitorPersistentRun = (execution: Execution, index: number, runId: string): void => {
    const { signal } = execution.controller
    let settled = false
    let unsubscribe = (): void => undefined
    const stopWatching = (): void => {
      if (settled) return
      settled = true
      unsubscribe()
      signal.removeEventListener('abort', stopWatching)
    }
    const onExit = (run: Run): void => {
      if (settled || signal.aborted || run.id !== runId || run.status !== 'exited') return
      stopWatching()
      if (run.stopped) {
        setStep(execution, index, 'stopped', { message: '已主动停止' })
        if (execution.state.status === 'running') {
          execution.abortStatus = 'stopped'
          execution.controller.abort()
        } else if (
          execution.state.status === 'ready' &&
          !execution.state.steps.some((step) => step.state === 'ready')
        ) {
          execution.state.status = 'stopped'
          execution.state.finishedAt = now().toISOString()
          publish(execution)
          persist()
        }
        return
      }

      setStep(execution, index, 'failed', {
        message: `持续运行任务异常退出（退出码 ${run.exitCode ?? '未知'}）`
      })
      if (execution.state.status === 'running') {
        execution.abortStatus = 'failed'
        execution.controller.abort()
      } else if (execution.state.status === 'ready') {
        execution.state.status = 'failed'
        execution.state.finishedAt = now().toISOString()
        publish(execution)
        persist()
      }
    }

    unsubscribe = subscribe((event) => {
      if (event.type === 'run-updated') onExit(event.run)
    })
    signal.addEventListener('abort', stopWatching)
    const current = runs.list().find((run) => run.id === runId)
    if (current) onExit(current)
  }

  const executeStep = async (
    group: Group,
    execution: Execution,
    step: GroupStep,
    index: number
  ): Promise<void> => {
    const { signal } = execution.controller
    setStep(execution, index, 'running', { message: '启动中' })

    let run: Run
    let reused: boolean
    try {
      const started = await startStep(step)
      run = started.run
      reused = started.reused
      setStep(execution, index, 'running', { runId: run.id, reused })
      if (signal.aborted) {
        if (!reused) await runs.stop(run.id).catch(() => undefined)
        setStep(execution, index, 'cancelled', { runId: run.id, reused })
        return
      }
    } catch (error) {
      setStep(execution, index, signal.aborted ? 'cancelled' : 'failed', {
        message: signal.aborted ? undefined : errorMessage(error)
      })
      return
    }

    // Parallel groups saved by older versions completed as soon as their processes started.
    if (!step.executionKind && group.mode === 'parallel') {
      setStep(execution, index, 'done', {
        runId: run.id,
        reused,
        message: reused ? '已在运行' : '已启动'
      })
      return
    }

    setStep(execution, index, 'running', {
      runId: run.id,
      reused,
      message: describeCondition(step.continueWhen)
    })
    try {
      await waitForCondition(
        step.continueWhen,
        run.id,
        {
          subscribe,
          getRun: (runId) => runs.list().find((candidate) => candidate.id === runId),
          getOutput: (runId) => runs.output(runId).data,
          checkPort,
          checkHttp
        },
        signal
      )
      if (step.executionKind === 'oneShot') {
        setStep(execution, index, 'completed')
      } else if (step.executionKind === 'persistent') {
        setStep(execution, index, 'ready')
        monitorPersistentRun(execution, index, run.id)
      } else {
        setStep(execution, index, 'done')
      }
    } catch (error) {
      if (error instanceof WaitCancelledError) {
        if (execution.state.steps[index]?.state === 'running') {
          setStep(execution, index, 'cancelled')
        }
        return
      }
      setStep(execution, index, 'failed', { message: errorMessage(error) })
    }
  }

  const runParallel = async (group: Group, execution: Execution): Promise<void> => {
    const { signal } = execution.controller
    await Promise.all(group.steps.map((step, index) => executeStep(group, execution, step, index)))
    const failed = execution.state.steps.some((step) => step.state === 'failed')
    finish(
      execution,
      signal.aborted
        ? (execution.abortStatus ?? 'stopped')
        : failed
          ? 'failed'
          : successStatus(group)
    )
  }

  const runSerial = async (group: Group, execution: Execution): Promise<void> => {
    const { signal } = execution.controller
    for (const [index, step] of group.steps.entries()) {
      if (signal.aborted) return finish(execution, execution.abortStatus ?? 'stopped')
      await executeStep(group, execution, step, index)
      if (signal.aborted) return finish(execution, execution.abortStatus ?? 'stopped')
      if (execution.state.steps[index]?.state === 'failed') return finish(execution, 'failed')
    }
    finish(execution, successStatus(group))
  }

  return {
    async start(groupId) {
      const group = await groups.get(groupId)
      if (executions.get(group.id)?.state.status === 'running') {
        throw new DevhubError('GROUP_ALREADY_RUNNING', `${group.name} 正在执行`)
      }
      executions.get(group.id)?.controller.abort()
      const execution: Execution = {
        controller: new AbortController(),
        state: {
          groupId: group.id,
          group: structuredClone(group),
          status: 'running',
          steps: group.steps.map((step) => ({ stepId: step.id, state: 'pending' }))
        }
      }
      executions.set(group.id, execution)
      publish(execution)

      // Runs in the background; progress and failures are reported through the state.
      const sequence = group.mode === 'parallel' ? runParallel : runSerial
      void sequence(execution.state.group ?? group, execution).catch((error: unknown) => {
        console.error('[groups] execution failed', error)
        finish(execution, 'failed')
      })
      return structuredClone(execution.state)
    },

    async stop(groupId) {
      const group = await groups.get(groupId)
      const execution = executions.get(group.id)
      execution?.controller.abort()
      await Promise.all(
        (execution?.state.group ?? restored.get(group.id)?.group ?? group).steps.map(
          async (step) => {
            const run = activeRunOf(step)
            if (run) await runs.stop(run.id)
          }
        )
      )
      if (execution) {
        let stoppedReadyStep = false
        execution.state.steps = execution.state.steps.map((step) => {
          if (step.state !== 'ready') return step
          stoppedReadyStep = true
          return { ...step, state: 'stopped', message: undefined }
        })
        if (execution.state.status === 'running' || execution.state.status === 'ready') {
          finish(execution, 'stopped')
        } else if (stoppedReadyStep) {
          publish(execution)
          persist()
        }
      }
    },

    async isRunning(groupId) {
      const group = await groups.get(groupId)
      const execution = executions.get(group.id)
      const definition = execution?.state.group ?? group
      return (
        execution?.state.status === 'running' ||
        definition.steps.some((step) => activeRunOf(step) !== undefined)
      )
    },

    async states() {
      await ready
      return latestStates()
    },

    async forget(groupId) {
      await ready
      executions.get(groupId)?.controller.abort()
      executions.delete(groupId)
      restored.delete(groupId)
      persist()
    },

    dispose() {
      for (const execution of executions.values()) execution.controller.abort()
    }
  }
}
