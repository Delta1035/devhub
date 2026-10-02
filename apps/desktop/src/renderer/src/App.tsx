import { useState } from 'react'
import { ProjectDetail } from '@renderer/features/projects/project-detail'
import { useGroupEventsSync } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { OrphansBanner } from '@renderer/features/runs/orphans-banner'
import { useRunEventsSync } from '@renderer/features/runs/use-runs'
import { SettingsPage } from '@renderer/features/settings/settings-page'
import { Sidebar } from '@renderer/features/sidebar/sidebar'
import { TitleBar } from '@renderer/features/title-bar/title-bar'

function App(): React.JSX.Element {
  useRunEventsSync()
  useGroupEventsSync()
  const { data: projects } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // Choosing a project in the sidebar leaves the settings page.
  const selectProject = (projectId: string): void => {
    setSelectedId(projectId)
    setShowSettings(false)
  }

  // Derived rather than synced: falls back to the first project when nothing is selected
  // or the selected one was removed.
  const selected = projects?.find((project) => project.id === selectedId) ?? projects?.[0]

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r p-3">
          <Sidebar
            selectedProjectId={showSettings ? null : (selected?.id ?? null)}
            currentProjectId={selected?.id ?? null}
            onSelectProject={selectProject}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <OrphansBanner />
          <div className="min-h-0 flex-1">
            {showSettings ? (
              <SettingsPage onClose={() => setShowSettings(false)} />
            ) : selected ? (
              <ProjectDetail key={selected.id} project={selected} />
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
