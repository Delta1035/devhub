import { lazy, Suspense, useState } from 'react'
import type { Run } from '@devhub/shared'
import { ProjectDetail } from '@renderer/features/projects/project-detail'
import { GroupDetail } from '@renderer/features/groups/group-detail'
import { useGroups, useGroupEventsSync } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { OrphansBanner } from '@renderer/features/runs/orphans-banner'
import { useRunEventsSync } from '@renderer/features/runs/use-runs'
import { Sheet, SheetContent, SheetTitle } from '@renderer/components/ui/sheet'
import { Sidebar } from '@renderer/features/sidebar/sidebar'
import { useResizableWidth } from '@renderer/features/sidebar/use-resizable-width'
import { TitleBar } from '@renderer/features/title-bar/title-bar'
import { useWorkspaceEventsSync } from '@renderer/features/workspaces/use-workspaces'
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
  useWorkspaceEventsSync()
  const { data: projects } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // Long project names stay readable when the sidebar is widened (default = Tailwind w-64).
  const sidebar = useResizableWidth('devhub.sidebarWidth', 256, 200)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  // On phones the sidebar is a drawer over the content, closed once something is chosen.
  const narrow = useMediaQuery(narrowQuery)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const groups = useGroups().data ?? []
  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  // Choosing a project in the sidebar leaves the settings page.
  const selectProject = (projectId: string): void => {
    setSelectedId(projectId)
    setSelectedGroupId(null)
    setRequestedRunId(null)
    setShowSettings(false)
    setDrawerOpen(false)
  }
  // Shows a specific run's terminal tab, e.g. a group step's log or a shell opened from the list.
  const openRun = (run: Run): void => {
    selectProject(run.projectId)
    setRequestedRunId(run.id)
  }

  // Derived rather than synced: falls back to the first project when nothing is selected
  // or the selected one was removed.
  const selected = projects?.find((project) => project.id === selectedId) ?? projects?.[0]

  const sidebarContent = (
    <Sidebar
      selectedGroupId={showSettings ? null : selectedGroupId}
      onSelectGroup={(groupId) => {
        setSelectedGroupId(groupId)
        setShowSettings(false)
        setDrawerOpen(false)
      }}
      selectedProjectId={showSettings || selectedGroup ? null : (selected?.id ?? null)}
      currentProjectId={selected?.id ?? null}
      onSelectProject={selectProject}
      onOpenRun={openRun}
    />
  )

  return (
    // dvh: on phones the browser's address bar would otherwise cover the bottom of the page.
    <div className="flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
      <TitleBar
        showSettings={showSettings}
        onToggleSettings={() => {
          setShowSettings(!showSettings)
          setDrawerOpen(false)
        }}
        onOpenNavigation={narrow ? () => setDrawerOpen(true) : undefined}
      />
      <div className="flex min-h-0 flex-1">
        {narrow ? (
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent
              side="left"
              showCloseButton={false}
              aria-describedby={undefined}
              className="w-[min(20rem,85vw)] gap-0 p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
            >
              <SheetTitle className="sr-only">导航</SheetTitle>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        ) : (
          <aside
            className="relative flex shrink-0 flex-col border-r p-3"
            style={{ width: sidebar.width }}
          >
            {sidebarContent}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整侧栏宽度"
              aria-valuenow={sidebar.width}
              tabIndex={0}
              title="拖动调整宽度，双击恢复默认"
              {...sidebar.handleProps}
              className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-primary/50 focus-visible:after:bg-primary"
            />
          </aside>
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <OrphansBanner />
          <div className="min-h-0 flex-1">
            {showSettings ? (
              <Suspense>
                <SettingsPage onClose={() => setShowSettings(false)} />
              </Suspense>
            ) : selectedGroup ? (
              <GroupDetail key={selectedGroup.id} group={selectedGroup} onOpenRun={openRun} />
            ) : selected ? (
              <ProjectDetail
                key={`${selected.id}:${requestedRunId ?? ''}`}
                project={selected}
                initialRunId={requestedRunId}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                添加一个项目后，这里会列出它的脚本
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
