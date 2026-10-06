import { useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { describeRun, isActive } from '@/features/runs/run-status'
import { useRestartRun, useRuns, useStopRun } from '@/features/runs/use-runs'
import { useRunLog } from '@/features/runs/use-run-log'
import { useColors } from '@/lib/theme'

export default function RunScreen(): React.JSX.Element {
  const { runId } = useLocalSearchParams<{ runId: string }>()
  const colors = useColors()
  const run = useRuns().data?.find((item) => item.id === runId)
  const { text, error } = useRunLog(runId)
  const stop = useStopRun()
  const restart = useRestartRun()
  const scroll = useRef<ScrollView>(null)
  // Follow new output until the user scrolls up; scrolling back to the end follows again.
  const [follow, setFollow] = useState(true)

  const status = describeRun(run)
  const active = isActive(run)
  const action = (): void => {
    if (!run) return
    const onError = (reason: Error): void => Alert.alert('操作失败', reason.message)
    if (active) stop.mutate(run.id, { onError })
    else restart.mutate(run.id, { onError })
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.logBackground }]}>
      <Stack.Screen
        options={{
          title: run?.title ?? '日志',
          headerRight: () =>
            run && run.kind === 'script' ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                disabled={run.status === 'stopping' || stop.isPending || restart.isPending}
                onPress={action}
              >
                <Text style={{ color: active ? colors.danger : colors.text }}>
                  {active ? '停止' : '重新运行'}
                </Text>
              </Pressable>
            ) : null
        }}
      />
      <Text style={[styles.status, { color: colors.tone[status.tone] }]}>
        {run ? `${status.label} · ${run.command}` : '运行已移除'}
      </Text>
      <ScrollView
        ref={scroll}
        style={styles.log}
        contentContainerStyle={styles.logContent}
        onContentSizeChange={() => {
          if (follow) scroll.current?.scrollToEnd({ animated: false })
        }}
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
          setFollow(contentOffset.y + layoutMeasurement.height >= contentSize.height - 24)
        }}
        scrollEventThrottle={100}
      >
        <Text selectable style={[styles.logText, { color: colors.logText }]}>
          {error ?? (text || '（暂无输出）')}
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  status: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 6, fontFamily: 'monospace' },
  log: { flex: 1 },
  logContent: { padding: 12 },
  logText: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 }
})
