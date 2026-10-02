import { useAppInfo } from '@renderer/features/app-info/use-app-info'
import { ProjectList } from '@renderer/features/projects/project-list'

function App(): React.JSX.Element {
  const { data: appInfo } = useAppInfo()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-baseline gap-3 border-b px-6 py-4">
        <h1 className="font-heading text-xl font-semibold">DevHub</h1>
        {appInfo && <span className="text-xs text-muted-foreground">v{appInfo.version}</span>}
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <ProjectList />
      </main>
    </div>
  )
}

export default App
