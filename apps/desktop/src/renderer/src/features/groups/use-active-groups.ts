import { useMemo } from 'react'
import { activeGroups, type ActiveGroup } from '@devhub/shared'
import { useRuns } from '@renderer/features/runs/use-runs'
import { useGroupStates, useGroups } from './use-groups'

export interface ActiveGroupView extends ActiveGroup {
  name: string
}

/** Batch runs still starting or with scripts alive, named after the current group. */
export function useActiveGroups(): ActiveGroupView[] {
  const groups = useGroups().data
  const states = useGroupStates().data
  const runs = useRuns().data
  return useMemo(
    () =>
      activeGroups(states ?? [], runs ?? []).map((active) => {
        const state = states?.find((candidate) => candidate.groupId === active.groupId)
        const name =
          groups?.find((group) => group.id === active.groupId)?.name ??
          state?.group?.name ??
          '（已删除的批量任务）'
        return { ...active, name }
      }),
    [groups, states, runs]
  )
}

/** "启动中 1/3" or "运行中 2/3". */
export function describeActiveGroup(group: ActiveGroup): string {
  return `${group.phase === 'starting' ? '启动中' : '运行中'} ${group.current}/${group.total}`
}

/** "前后端联调（运行中 2/3）、全量构建（启动中 0/2）" for tooltips and screen readers. */
export function describeActiveGroups(groups: ActiveGroupView[]): string {
  return groups.map((group) => `${group.name}（${describeActiveGroup(group)}）`).join('、')
}
