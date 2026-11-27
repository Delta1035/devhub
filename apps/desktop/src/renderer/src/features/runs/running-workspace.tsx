import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { useActiveGroups } from '@renderer/features/groups/use-active-groups'
import { useGroupStates } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { SidebarRunningSection } from '@renderer/features/sidebar/sidebar-running-section'
import { buildRunningHierarchy } from './running-hierarchy'
import { useRunHealth } from './use-run-health'
import { useRuns } from './use-runs'

interface RunningWorkspaceProps {
  onSelectGroup: (groupId: string) => void
  onOpenRun: (run: Run) => void
}

export function RunningWorkspace({
  onSelectGroup,
  onOpenRun
}: RunningWorkspaceProps): React.JSX.Element {
  const activeGroups = useActiveGroups()
  const groupStates = useGroupStates().data ?? []
  const runs = useRuns().data
  const activeRuns = useMemo(() => (runs ?? []).filter((run) => run.status !== 'exited'), [runs])
  const projects = useProjects().data ?? []
  const health = useRunHealth().data ?? []

  const hierarchy = useMemo(
    () =>
      buildRunningHierarchy({
        activeGroups,
        groupStates,
        activeRuns,
        projects,
        health
      }),
    [activeGroups, groupStates, activeRuns, projects, health]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 py-3 md:px-6 md:py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            运行中
          </h1>
          <p className="text-xs text-muted-foreground">{hierarchy.subtitle}</p>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
        {hierarchy.hasActive ? (
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <SidebarRunningSection
              variant="page"
              hierarchy={hierarchy}
              onSelectGroup={onSelectGroup}
              onOpenRun={onOpenRun}
            />
          </div>
        ) : (
          <div
            role="status"
            aria-label="运行中空状态"
            className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground shadow-xs">
              <Activity className="size-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">当前没有运行中的任务</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                启动项目脚本或批量任务后，它们会在这里集中显示，方便查看日志和停止运行。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
