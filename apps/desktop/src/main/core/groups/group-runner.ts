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
    extra: { runId?: string; message?: string } = {}
  ): void => {
    const step = execution.state.steps[index]
    if (!step) return
    step.state = state
    if (extra.runId !== undefined) step.runId = extra.runId
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

  const runParallel = async (group: Group, execution: Execution): Promise<void> => {
    await Promise.all(
      group.steps.map(async (step, index) => {
        setStep(execution, index, 'running', { message: '启动中' })
        try {
          const { run, reused } = await startStep(step)
          setStep(execution, index, 'done', {
            runId: run.id,
            message: reused ? '已在运行' : '已启动'
          })
        } catch (error) {
          setStep(execution, index, 'failed', { message: errorMessage(error) })
        }
      })
    )
    const failed = execution.state.steps.some((step) => step.state === 'failed')
    finish(execution, failed ? 'failed' : 'done')
  }

  const runSerial = async (group: Group, execution: Execution): Promise<void> => {
    const { signal } = execution.controller
    for (const [index, step] of group.steps.entries()) {
      if (signal.aborted) return finish(execution, 'stopped')
      setStep(execution, index, 'running', { message: '启动中' })

      let run: Run
      try {
        const started = await startStep(step)
        run = started.run
        // Stopped while this step was starting: stop() could not see the new run yet.
        if (signal.aborted) {
          if (!started.reused) await runs.stop(run.id).catch(() => undefined)
          return finish(execution, 'stopped')
        }
      } catch (error) {
        setStep(execution, index, 'failed', { message: errorMessage(error) })
        return finish(execution, 'failed')
      }

      setStep(execution, index, 'running', {
        runId: run.id,
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
        setStep(execution, index, 'done')
      } catch (error) {
        if (error instanceof WaitCancelledError) return finish(execution, 'stopped')
        setStep(execution, index, 'failed', { message: errorMessage(error) })
        return finish(execution, 'failed')
      }
    }
    finish(execution, 'done')
  }

  return {
    async start(groupId) {
      const group = await groups.get(groupId)
      if (executions.get(group.id)?.state.status === 'running') {
        throw new DevhubError('GROUP_ALREADY_RUNNING', `${group.name} 正在执行`)
      }
      const execution: Execution = {
        controller: new AbortController(),
        state: {
          groupId: group.id,
          status: 'running',
          steps: group.steps.map((step) => ({ stepId: step.id, state: 'pending' }))
        }
      }
      executions.set(group.id, execution)
      publish(execution)

      // Runs in the background; progress and failures are reported through the state.
      const sequence = group.mode === 'parallel' ? runParallel : runSerial
      void sequence(group, execution).catch((error: unknown) => {
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
        group.steps.map(async (step) => {
          const run = activeRunOf(step)
          if (run) await runs.stop(run.id)
        })
      )
      if (execution?.state.status === 'running') finish(execution, 'stopped')
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
