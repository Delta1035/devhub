import type { ScheduleTarget } from '@devhub/shared'
import type { GroupRunner } from '../groups/group-runner'
import type { GroupService } from '../groups/group-service'
import type { RunManager } from '../process/run-manager'
import type { ScriptService } from '../scripts/script-service'
import type { ScheduleTargetExecutor } from './schedule-service'

export interface ScheduleTargetExecutorDeps {
  scripts: ScriptService
  runs: RunManager
  groupService: GroupService
  groupRunner: GroupRunner
}

export function createScheduleTargetExecutor({
  scripts,
  runs,
  groupService,
  groupRunner
}: ScheduleTargetExecutorDeps): ScheduleTargetExecutor {
  return {
    validate: async (target: ScheduleTarget) => {
      if (target.kind === 'script') {
        await scripts.find(target.projectId, target.scriptId)
      } else {
        await groupService.get(target.groupId)
      }
    },
    isRunning: async (target: ScheduleTarget) => {
      if (target.kind === 'script') {
        return runs
          .list()
          .some(
            (run) =>
              run.kind === 'script' &&
              run.projectId === target.projectId &&
              run.scriptId === target.scriptId &&
              run.status !== 'exited'
          )
      }
      return groupRunner.isRunning(target.groupId)
    },
    start: async (target: ScheduleTarget) => {
      if (target.kind === 'script') await runs.start(target.projectId, target.scriptId)
      else await groupRunner.start(target.groupId)
    },
    stop: async (target: ScheduleTarget) => {
      if (target.kind === 'script') {
        const activeRuns = runs
          .list()
          .filter(
            (run) =>
              run.kind === 'script' &&
              run.projectId === target.projectId &&
              run.scriptId === target.scriptId &&
              run.status !== 'exited'
          )
        await Promise.all(activeRuns.map((run) => runs.stop(run.id)))
      } else {
        await groupRunner.stop(target.groupId)
      }
    }
  }
}
