import { useState } from 'react'
import { TriangleAlert, Workflow, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { useGroups } from '@renderer/features/groups/use-groups'
import { useRuns, useStartScript } from '@renderer/features/runs/use-runs'
import { ScriptList } from '@renderer/features/scripts/script-list'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { TerminalPanel } from '@renderer/features/terminal/terminal-panel'
import { cn } from '@renderer/lib/utils'
import { ProjectHeader } from './project-header'
import { ProjectHistoryTab } from './project-history-tab'
import { ProjectSettingsTab } from './project-settings-tab'
import { ProjectSubnav, type ProjectViewTab } from './project-subnav'

export function ProjectDetail({
  project,
  initialRunId = null
}: {
  project: Project
  initialRunId?: string | null
}): React.JSX.Element {
  const scripts = useProjectScripts(project.id)
  const runs = (useRuns().data ?? []).filter((r) => r.projectId === project.id)
  const activeRuns = runs.filter((r) => r.status !== 'exited')
  const allGroups = useGroups().data ?? []
  const projectBatchTasks = allGroups.filter((g) =>
    g.steps.some((s: { projectId: string }) => s.projectId === project.id)
  )
  const startScript = useStartScript()

  const [currentTab, setCurrentTab] = useState<ProjectViewTab>(() =>
    initialRunId ? 'terminals' : 'scripts'
  )
  const [filterQuery, setFilterQuery] = useState('')
  const [activeRunId, setActiveRunId] = useState<string | null>(initialRunId)
  const [editorError, setEditorError] = useState<Error | null>(null)
  const [terminalMaximized, setTerminalMaximized] = useState(false)

  const scriptItems = scripts.data?.scripts ?? []
  const primaryScript =
    scriptItems.find((s) => /dev|start|serve/.test(s.name.toLowerCase())) ?? scriptItems[0]

  const handleQuickStart = primaryScript
    ? () => {
        startScript.mutate(
          { projectId: project.id, scriptId: primaryScript.id },
          {
            onSuccess: (run) => {
              setActiveRunId(run.id)
            }
          }
        )
      }
    : undefined

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Modern Project Header */}
      <ProjectHeader
        project={project}
        activeRunsCount={activeRuns.length}
        scripts={scriptItems}
        runs={runs}
        isFetching={scripts.isFetching}
        onRefresh={() => void scripts.refetch()}
        onEditorError={setEditorError}
      />

      {/* 5-Tab Subnav with Search & Quick Start */}
      <ProjectSubnav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        scriptsCount={scriptItems.length}
        activeTerminalsCount={activeRuns.length}
        tasksCount={projectBatchTasks.length}
        filterQuery={filterQuery}
        onFilterChange={setFilterQuery}
        onQuickStart={handleQuickStart}
        isStarting={startScript.isPending}
      />

      {editorError && (
        <Alert variant="destructive" className="m-4">
          <TriangleAlert />
          <AlertTitle>无法打开编辑器</AlertTitle>
          <AlertDescription>{editorError.message}</AlertDescription>
          <AlertAction>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditorError(null)}
              aria-label="关闭"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {/* Tab 1: Scripts View (Split view with TerminalPanel at bottom) */}
      {currentTab === 'scripts' && (
        <>
          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6',
              terminalMaximized && 'hidden'
            )}
          >
            <ScriptList
              project={project}
              filterQuery={filterQuery}
              onRunStarted={(run) => setActiveRunId(run.id)}
              onOpenSettings={() => setCurrentTab('settings')}
            />
          </div>
          <TerminalPanel
            projectId={project.id}
            activeRunId={activeRunId}
            onActiveRunChange={setActiveRunId}
            maximized={terminalMaximized}
            onToggleMaximized={() => setTerminalMaximized(!terminalMaximized)}
          />
        </>
      )}

      {/* Tab 2: Terminals View (Terminal Panel takes full area) */}
      {currentTab === 'terminals' && (
        <TerminalPanel
          projectId={project.id}
          activeRunId={activeRunId}
          onActiveRunChange={setActiveRunId}
          maximized={true}
          onToggleMaximized={() => setCurrentTab('scripts')}
        />
      )}

      {/* Tab 3: History View */}
      {currentTab === 'history' && (
        <div className="min-h-0 flex-1">
          <ProjectHistoryTab project={project} scripts={scriptItems} />
        </div>
      )}

      {/* Tab 4: Tasks View */}
      {currentTab === 'tasks' && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-base font-semibold text-foreground">
              关联批量任务 ({projectBatchTasks.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              包含此项目脚本的批量任务。可在左侧底部「批量任务」中查看全局编排。
            </p>
            {projectBatchTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-border/80">
                <Workflow className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">暂无包含此项目脚本的批量任务</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {projectBatchTasks.map((group) => (
                  <li
                    key={group.id}
                    className="flex items-center justify-between rounded-lg border border-border/80 bg-card/60 p-3.5"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-foreground">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.steps.length} 个步骤 ·{' '}
                        {group.mode === 'parallel' ? '并行启动' : '串行流水线'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Settings View */}
      {currentTab === 'settings' && (
        <div className="min-h-0 flex-1">
          <ProjectSettingsTab project={project} scripts={scriptItems} />
        </div>
      )}
    </div>
  )
}
