import { Activity } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { useActiveGroups } from '@renderer/features/groups/use-active-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { useRuns } from './use-runs'
import { SidebarRunningSection } from '@renderer/features/sidebar/sidebar-running-section'

interface RunningWorkspaceProps {
  onSelectGroup: (groupId: string) => void
  onOpenRun: (run: Run) => void
}

export function RunningWorkspace({
  onSelectGroup,
  onOpenRun
}: RunningWorkspaceProps): React.JSX.Element {
  const activeGroups = useActiveGroups()
  const activeRuns = (useRuns().data ?? []).filter((run) => run.status !== 'exited')
  const projects = useProjects().data ?? []
  const totalCount = activeGroups.length + activeRuns.length

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-6 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            运行中
          </h1>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${totalCount} 个活动项正在运行` : '查看当前项目脚本和批量任务'}
          </p>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-5">
        {totalCount > 0 ? (
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            <SidebarRunningSection
              variant="page"
              activeRuns={activeRuns}
              activeGroups={activeGroups}
              projects={projects}
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
