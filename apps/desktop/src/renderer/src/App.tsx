import { useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { ProjectDetail } from '@renderer/features/projects/project-detail'
import { useGroupEventsSync } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { OrphansBanner } from '@renderer/features/runs/orphans-banner'
import { useRunEventsSync } from '@renderer/features/runs/use-runs'
import { SettingsPage } from '@renderer/features/settings/settings-page'
import { Sidebar } from '@renderer/features/sidebar/sidebar'
import { UpdateBadge } from '@renderer/features/updates/update-badge'

function App(): React.JSX.Element {
  const { data: appInfo } = useAppInfo()
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
      <header className="flex items-center gap-3 border-b px-6 py-2.5">
        <h1 className="font-heading text-lg font-semibold">DevHub</h1>
        {appInfo && <span className="text-xs text-muted-foreground">v{appInfo.version}</span>}
        <div className="ml-auto">
          <UpdateBadge />
        </div>
        <Button
          variant={showSettings ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={() => setShowSettings(!showSettings)}
          aria-label="设置"
          aria-pressed={showSettings}
          title="设置"
        >
          <SettingsIcon />
        </Button>
      </header>
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
