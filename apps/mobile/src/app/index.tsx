import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useConnection } from '@/api'
import { useProjects } from '@/features/projects/use-projects'
import { activeProjectIds } from '@/features/runs/run-status'
import { useRuns } from '@/features/runs/use-runs'
import { ListState } from '@/lib/list-state'
import { useColors } from '@/lib/theme'

export default function ProjectsScreen(): React.JSX.Element {
  const { state, disconnect } = useConnection()
  const colors = useColors()
  const router = useRouter()
  const projects = useProjects()
  const runs = useRuns()
  const active = activeProjectIds(runs.data ?? [])
  const address = state.status === 'connected' ? state.settings.baseUrl : ''

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void disconnect()}>
              <Text style={{ color: colors.danger }}>断开</Text>
            </Pressable>
          )
        }}
      />
      <Text style={[styles.address, { color: colors.muted }]}>{address}</Text>
      <FlatList
        data={projects.data ?? []}
        keyExtractor={(project) => project.id}
        refreshControl={
          <RefreshControl
            refreshing={projects.isRefetching}
            onRefresh={() => void Promise.all([projects.refetch(), runs.refetch()])}
          />
        }
        ListEmptyComponent={<ListState query={projects} empty="桌面端还没有项目" />}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderColor: colors.border }]}
            onPress={() =>
              router.push({ pathname: '/projects/[projectId]', params: { projectId: item.id } })
            }
          >
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.path, { color: colors.muted }]} numberOfLines={1}>
                {item.path}
              </Text>
            </View>
            {active.has(item.id) ? (
              <View style={[styles.dot, { backgroundColor: colors.tone.running }]} />
            ) : null}
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  address: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  path: { fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 12 }
})
