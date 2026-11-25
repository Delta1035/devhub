import { lazy, Suspense, useState } from 'react'
import { sortProjects, type Run } from '@devhub/shared'
import { BatchWorkspace } from '@renderer/features/groups/batch-workspace'
import { useActiveGroups } from '@renderer/features/groups/use-active-groups'
import { useGroupEventsSync } from '@renderer/features/groups/use-groups'
import { ProjectWorkspace } from '@renderer/features/projects/project-workspace'
import { useProjects } from '@renderer/features/projects/use-projects'
import { OrphansBanner } from '@renderer/features/runs/orphans-banner'
import { countSidebarRunningBadge } from '@renderer/features/runs/running-hierarchy'
import { RunningWorkspace } from '@renderer/features/runs/running-workspace'
import { useRunEventsSync, useRuns } from '@renderer/features/runs/use-runs'
import { ScheduleWorkspace } from '@renderer/features/schedules/schedule-workspace'
import { useScheduleEventsSync } from '@renderer/features/schedules/use-schedules'
import { Sheet, SheetContent, SheetTitle } from '@renderer/components/ui/sheet'
import { Sidebar, type SidebarView } from '@renderer/features/sidebar/sidebar'
import { SidebarSkeleton } from '@renderer/features/sidebar/sidebar-skeleton'
import { GlobalSearchDialog } from '@renderer/features/search/global-search-dialog'
import { Toaster } from '@renderer/components/ui/toaster'
import { StatusBar } from '@renderer/features/status-bar/status-bar'
import { TitleBar } from '@renderer/features/title-bar/title-bar'
import { useWorkspaceEventsSync, useWorkspaces } from '@renderer/features/workspaces/use-workspaces'
import { narrowQuery, useMediaQuery } from '@renderer/lib/use-media-query'

// Opened now and then; also carries the QR code encoder.
const SettingsPage = lazy(() =>
  import('@renderer/features/settings/settings-page').then(({ SettingsPage }) => ({
    default: SettingsPage
  }))
)

function App(): React.JSX.Element {
  useRunEventsSync()
  useGroupEventsSync()
  useScheduleEventsSync()
  useWorkspaceEventsSync()
  useWorkspaces()
  const { data: projects } = useProjects()
  const { data: runs } = useRuns()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeView, setActiveView] = useState<SidebarView>(() => {
    const stored = localStorage.getItem('devhub.activeView')
    return stored === 'groups' || stored === 'running' || stored === 'schedules'
      ? stored
      : 'projects'
  })
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  // On phones the sidebar is a drawer over the content, closed once something is chosen.
  const narrow = useMediaQuery(narrowQuery)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerReady, setDrawerReady] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const activeRuns = (runs ?? []).filter((run) => run.status !== 'exited')
  const activeGroups = useActiveGroups()
  const runningBadgeCount = countSidebarRunningBadge(activeRuns, activeGroups)

  const selectView = (view: SidebarView): void => {
    setActiveView(view)
    localStorage.setItem('devhub.activeView', view)
    setShowSettings(false)
    setDrawerOpen(false)
  }

  const openSettings = (): void => {
    setShowSettings(true)
    setDrawerOpen(false)
  }

  // Choosing a project in the sidebar leaves the settings and batch page.
  const selectProject = (projectId: string): void => {
    setSelectedId(projectId)
    setSelectedGroupId(null)
    setRequestedRunId(null)
    setShowSettings(false)
    setDrawerOpen(false)
    selectView('projects')
  }

  // Choosing batch tasks or a group switches to batch workspace.
  const selectBatch = (groupId?: string | null): void => {
    selectView('groups')
    if (groupId) {
      setSelectedGroupId(groupId)
    }
  }

  // Shows a specific run's terminal tab, e.g. a group step's log or a shell opened from the list.
  const openRun = (run: Run): void => {
    selectProject(run.projectId)
    setRequestedRunId(run.id)
  }

  // Falls back to the first active project or the first project in the list when nothing is
  // selected or the selected one was removed.
  const fallbackProject =
    runs && projects ? (sortProjects(projects, runs)[0] ?? projects[0]) : projects?.[0]
  const chosen = projects?.find((project) => project.id === selectedId)
  // Once runs are known the fallback is kept as the selection, so starting another script
  // does not move the detail view (and remount its terminals) to the newest active project.
  if (!chosen && runs && fallbackProject) setSelectedId(fallbackProject.id)
  const selected = chosen ?? fallbackProject

  return (
    // dvh: on phones the browser's address bar would otherwise cover the bottom of the page.
    <div className="flex h-dvh flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
      <TitleBar
        showSettings={showSettings}
        onOpenSettings={openSettings}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNavigation={narrow ? () => setDrawerOpen(true) : undefined}
      />
      <GlobalSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelectProject={selectProject}
        onSelectGroup={(groupId) => selectBatch(groupId)}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {narrow ? (
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent
              side="left"
              showCloseButton={false}
              aria-describedby={undefined}
              className="w-[min(20rem,85vw)] gap-0 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
              onAnimationEnd={(event) => {
                if (event.target === event.currentTarget && drawerOpen) setDrawerReady(true)
              }}
            >
              <SheetTitle className="sr-only">导航</SheetTitle>
              {drawerReady || reducedMotion ? (
                <Sidebar
                  activeView={activeView}
                  activeCount={runningBadgeCount}
                  onViewChange={selectView}
                  compact={false}
                />
              ) : (
                <SidebarSkeleton />
              )}
            </SheetContent>
          </Sheet>
        ) : (
          <aside className="flex w-14 shrink-0 flex-col border-r border-border bg-sidebar p-2">
            <Sidebar
              activeView={activeView}
              activeCount={runningBadgeCount}
              onViewChange={selectView}
              compact={true}
            />
          </aside>
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <OrphansBanner />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {showSettings ? (
              <Suspense>
                <SettingsPage onClose={() => setShowSettings(false)} />
              </Suspense>
            ) : activeView === 'projects' ? (
              <ProjectWorkspace
                narrow={narrow}
                selectedProject={selected}
                requestedRunId={requestedRunId}
                onSelectProject={selectProject}
                onOpenRun={openRun}
              />
            ) : activeView === 'groups' ? (
              <BatchWorkspace
                selectedGroupId={selectedGroupId}
                onSelectGroup={(groupId) => setSelectedGroupId(groupId)}
                onOpenRun={openRun}
              />
            ) : activeView === 'schedules' ? (
              <ScheduleWorkspace />
            ) : (
              <RunningWorkspace
                onSelectGroup={(groupId) => selectBatch(groupId)}
                onOpenRun={openRun}
              />
            )}
          </div>
        </main>
      </div>
      <StatusBar onOpenRun={openRun} onOpenRunningView={() => selectView('running')} />
      <Toaster />
    </div>
  )
}

export default App
