import type { ActiveGroup, GroupMode, GroupRunState, Project, Run, RunHealth } from '@devhub/shared'
import type { ActiveGroupView } from '@renderer/features/groups/use-active-groups'

export interface RunningChildItem {
  run: Run
  projectName: string
  health: RunHealth | undefined
  /** 1-based step numbers inside this batch group that point to this run. */
  stepNumbers: number[]
  /** True when the batch execution reused an already-running process for any matching step. */
  reused: boolean
  /** Names of other active batch groups that also include this run. */
  sharedWithGroupNames: string[]
}

export interface RunningGroupNode {
  group: ActiveGroupView
  mode: GroupMode | undefined
  children: RunningChildItem[]
  waitingMessage: string | null
}

export interface RunningStandaloneItem {
  run: Run
  projectName: string
  health: RunHealth | undefined
}

export interface RunningHierarchy {
  groupNodes: RunningGroupNode[]
  standaloneRuns: RunningStandaloneItem[]
  activeRunCount: number
  activeGroupCount: number
  hasActive: boolean
  subtitle: string
}

export interface BuildRunningHierarchyInput {
  activeGroups: readonly ActiveGroupView[]
  groupStates: readonly GroupRunState[]
  activeRuns: readonly Run[]
  projects: readonly Project[]
  health?: readonly RunHealth[]
}

/**
 * Organizes active runs and active batch groups into a parent-child hierarchy,
 * preserving cross-group reuse links and separating standalone runs.
 */
export function buildRunningHierarchy({
  activeGroups,
  groupStates,
  activeRuns,
  projects,
  health = []
}: BuildRunningHierarchyInput): RunningHierarchy {
  const runById = new Map(activeRuns.map((run) => [run.id, run]))
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]))
  const healthByRunId = new Map(health.map((entry) => [entry.runId, entry]))
  const stateByGroupId = new Map(groupStates.map((state) => [state.groupId, state]))

  const groupsByRunId = new Map<string, ActiveGroupView[]>()
  const groupedRunIds = new Set<string>()
  for (const group of activeGroups) {
    for (const runId of group.runIds) {
      if (!runById.has(runId)) continue
      groupedRunIds.add(runId)
      const list = groupsByRunId.get(runId)
      if (list) {
        list.push(group)
      } else {
        groupsByRunId.set(runId, [group])
      }
    }
  }

  const groupNodes: RunningGroupNode[] = activeGroups.map((group) => {
    const state = stateByGroupId.get(group.groupId)
    const stepMetaByRunId = new Map<string, { stepNumbers: number[]; reused: boolean }>()

    if (state) {
      state.steps.forEach((step, index) => {
        if (!step.runId || !runById.has(step.runId)) return
        const existing = stepMetaByRunId.get(step.runId)
        if (existing) {
          existing.stepNumbers.push(index + 1)
          existing.reused = existing.reused || Boolean(step.reused)
        } else {
          stepMetaByRunId.set(step.runId, {
            stepNumbers: [index + 1],
            reused: Boolean(step.reused)
          })
        }
      })
    }

    for (const runId of group.runIds) {
      if (runById.has(runId) && !stepMetaByRunId.has(runId)) {
        stepMetaByRunId.set(runId, { stepNumbers: [], reused: false })
      }
    }

    const children: RunningChildItem[] = []
    for (const [runId, meta] of stepMetaByRunId) {
      const run = runById.get(runId)
      if (!run) continue
      const sharedWithGroupNames = (groupsByRunId.get(runId) ?? [])
        .filter((candidate) => candidate.groupId !== group.groupId)
        .map((candidate) => candidate.name)

      children.push({
        run,
        projectName: projectNameById.get(run.projectId) ?? '未知项目',
        health: healthByRunId.get(run.id),
        stepNumbers: meta.stepNumbers,
        reused: meta.reused,
        sharedWithGroupNames
      })
    }

    const waitingMessage =
      group.phase === 'starting'
        ? (state?.steps.find((step) => step.state === 'running' && step.message)?.message ?? null)
        : null

    return {
      group,
      mode: state?.group?.mode,
      children,
      waitingMessage
    }
  })

  const standaloneRuns: RunningStandaloneItem[] = activeRuns
    .filter((run) => !groupedRunIds.has(run.id))
    .map((run) => ({
      run,
      projectName: projectNameById.get(run.projectId) ?? '未知项目',
      health: healthByRunId.get(run.id)
    }))

  const activeRunCount = activeRuns.length
  const activeGroupCount = activeGroups.length
  const hasActive = activeRunCount > 0 || activeGroupCount > 0

  let subtitle = '查看当前项目脚本和批量任务'
  if (activeGroupCount > 0 && activeRunCount > 0) {
    subtitle =
      standaloneRuns.length > 0
        ? `${activeRunCount} 个活动项运行中（含 ${activeGroupCount} 个批量任务、${standaloneRuns.length} 个独立运行）`
        : `${activeRunCount} 个子任务运行中 · 关联 ${activeGroupCount} 个批量任务`
  } else if (activeGroupCount > 0) {
    subtitle = `${activeGroupCount} 个批量任务正在启动`
  } else if (activeRunCount > 0) {
    subtitle = `${activeRunCount} 个独立运行中的脚本/终端`
  }

  return {
    groupNodes,
    standaloneRuns,
    activeRunCount,
    activeGroupCount,
    hasActive,
    subtitle
  }
}

/** Counts running processes without double-counting parent batch groups that already have child runs. */
export function countSidebarRunningBadge(
  activeRuns: readonly Run[],
  activeGroups: readonly ActiveGroup[]
): number {
  const activeRunIds = new Set(
    activeRuns.filter((run) => run.status !== 'exited').map((run) => run.id)
  )
  const startingGroupsWithoutRuns = activeGroups.filter(
    (group) => !group.runIds.some((runId) => activeRunIds.has(runId))
  ).length
  return activeRunIds.size + startingGroupsWithoutRuns
}
