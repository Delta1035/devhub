import { useAppInfo } from '@renderer/features/app-info/use-app-info'

function App(): React.JSX.Element {
  const { data: appInfo } = useAppInfo()

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-100">
      <h1 className="text-3xl font-semibold">DevHub</h1>
      <p className="text-sm text-zinc-400">
        {appInfo ? `v${appInfo.version} · ${appInfo.platform}` : '连接核心中…'}
      </p>
    </main>
  )
}

export default App
