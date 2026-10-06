import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { Run, Script } from '@devhub/shared'
import { useProjects, useScripts } from '@/features/projects/use-projects'
import { describeRun, isActive, runsByScript } from '@/features/runs/run-status'
import {
  PortConflictError,
  useRuns,
  useStartScript,
  useStopRun,
  type StartScriptInput
} from '@/features/runs/use-runs'
import { ListState } from '@/lib/list-state'
import { useColors } from '@/lib/theme'

export default function ProjectScreen(): React.JSX.Element {
  const { projectId } = useLocalSearchParams<{ projectId: string }>()
  const colors = useColors()
  const router = useRouter()
  const project = useProjects().data?.find((item) => item.id === projectId)
  const scripts = useScripts(projectId)
  const runs = useRuns()
  const byScript = runsByScript(runs.data ?? [], projectId)
  const start = useStartScript()
  const stop = useStopRun()

  const startScript = (input: StartScriptInput): void => {
    start.mutate(input, {
      onSuccess: (run) => router.push({ pathname: '/runs/[runId]', params: { runId: run.id } }),
      onError: (error) => {
        if (error instanceof PortConflictError) {
          Alert.alert('端口被占用', error.message, [
            { text: '取消', style: 'cancel' },
            {
              text: '仍然启动',
              onPress: () => startScript({ ...input, ignorePortConflicts: true })
            }
          ])
        } else {
          Alert.alert('启动失败', error.message)
        }
      }
    })
  }

  const stopRun = (run: Run): void => {
    stop.mutate(run.id, { onError: (error) => Alert.alert('停止失败', error.message) })
  }

  const data = scripts.data
  const notice =
    data?.status === 'missing'
      ? '项目目录不存在'
      : data?.warnings.map((warning) => warning.message).join('\n')

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: project?.name ?? '' }} />
      {notice ? (
        <Text style={[styles.notice, { color: colors.tone.pending }]}>{notice}</Text>
      ) : null}
      <FlatList
        data={data?.scripts ?? []}
        keyExtractor={(script) => script.id}
        refreshControl={
          <RefreshControl
            refreshing={scripts.isRefetching}
            onRefresh={() => void Promise.all([scripts.refetch(), runs.refetch()])}
          />
        }
        ListEmptyComponent={<ListState query={scripts} empty="没有识别到脚本" />}
        renderItem={({ item }) => (
          <ScriptRow
            script={item}
            run={byScript.get(item.id)}
            busy={start.isPending && start.variables.scriptId === item.id}
            onStart={() => startScript({ projectId, scriptId: item.id })}
            onStop={stopRun}
            onOpen={(run) => router.push({ pathname: '/runs/[runId]', params: { runId: run.id } })}
          />
        )}
      />
    </View>
  )
}

function ScriptRow({
  script,
  run,
  busy,
  onStart,
  onStop,
  onOpen
}: {
  script: Script
  run: Run | undefined
  busy: boolean
  onStart: () => void
  onStop: (run: Run) => void
  onOpen: (run: Run) => void
}): React.JSX.Element {
  const colors = useColors()
  const status = describeRun(run)
  const active = isActive(run)
  return (
    <Pressable
      disabled={!run}
      onPress={() => run && onOpen(run)}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{script.name}</Text>
        <Text style={[styles.command, { color: colors.muted }]} numberOfLines={1}>
          {script.command}
        </Text>
        <Text style={{ color: colors.tone[status.tone], fontSize: 12 }}>
          {status.label}
          {run ? ' · 查看日志' : ''}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy || run?.status === 'stopping'}
        onPress={() => (run && active ? onStop(run) : onStart())}
        style={[
          styles.action,
          { borderColor: active ? colors.danger : colors.primary, opacity: busy ? 0.5 : 1 }
        ]}
      >
        <Text style={{ color: active ? colors.danger : colors.text, fontWeight: '600' }}>
          {busy ? '启动中' : active ? '停止' : '启动'}
        </Text>
      </Pressable>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  notice: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  command: { fontSize: 12, fontFamily: 'monospace' },
  action: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }
})
