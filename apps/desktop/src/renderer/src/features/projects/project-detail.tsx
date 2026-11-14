import { useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
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
        isFetching={scripts.isFetching}
        onRefresh={() => void scripts.refetch()}
        onEditorError={setEditorError}
      />

      {/* 4-Tab Subnav with Search & Quick Start */}
      <ProjectSubnav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        scriptsCount={scriptItems.length}
        activeTerminalsCount={activeRuns.length}
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

      {/* Tab 4: Settings View */}
      {currentTab === 'settings' && (
        <div className="min-h-0 flex-1">
          <ProjectSettingsTab project={project} scripts={scriptItems} />
        </div>
      )}
    </div>
  )
}
