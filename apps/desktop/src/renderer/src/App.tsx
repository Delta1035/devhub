import { useState } from 'react'
import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { ProjectDetail } from '@renderer/features/projects/project-detail'
import { ProjectList } from '@renderer/features/projects/project-list'
import { useProjects } from '@renderer/features/projects/use-projects'

function App(): React.JSX.Element {
  const { data: appInfo } = useAppInfo()
  const { data: projects } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Derived rather than synced: falls back to the first project when nothing is selected
  // or the selected one was removed.
  const selected = projects?.find((project) => project.id === selectedId) ?? projects?.[0]

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-baseline gap-3 border-b px-6 py-3">
        <h1 className="font-heading text-lg font-semibold">DevHub</h1>
        {appInfo && <span className="text-xs text-muted-foreground">v{appInfo.version}</span>}
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r p-3">
          <ProjectList selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        </aside>
        <main className="min-w-0 flex-1">
          {selected ? (
            <ProjectDetail key={selected.id} project={selected} />
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              添加一个项目后，这里会列出它的脚本
            </p>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
