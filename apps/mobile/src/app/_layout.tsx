import { useState } from 'react'
import { ActivityIndicator, useColorScheme, View } from 'react-native'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider, useConnection } from '@/api'
import { useProjectEventsSync } from '@/features/projects/use-projects'
import { useRunEventsSync } from '@/features/runs/use-runs'
import { useColors } from '@/lib/theme'

export default function RootLayout(): React.JSX.Element {
  const scheme = useColorScheme()
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } })
  )
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <RootStack />
        </ConnectionProvider>
      </QueryClientProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  )
}

function RootStack(): React.JSX.Element {
  const { state } = useConnection()
  const colors = useColors()
  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator />
      </View>
    )
  }
  const connected = state.status === 'connected'
  return (
    <>
      {connected ? <EventsSync /> : null}
      <Stack>
        <Stack.Protected guard={connected}>
          <Stack.Screen name="index" options={{ title: 'DevHub' }} />
          <Stack.Screen name="projects/[projectId]" options={{ title: '' }} />
          <Stack.Screen name="runs/[runId]" options={{ title: '日志' }} />
        </Stack.Protected>
        <Stack.Protected guard={!connected}>
          <Stack.Screen name="connect" options={{ title: '连接 DevHub' }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}

/** Keeps cached queries in sync with the desktop's pushed events while connected. */
function EventsSync(): null {
  useRunEventsSync()
  useProjectEventsSync()
  return null
}
