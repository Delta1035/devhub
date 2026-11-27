import type { ActiveGroup, Group, GroupRunState } from '@devhub/shared'

export type GroupDisplayPhase = 'idle' | 'starting' | 'running' | 'ready' | 'done' | 'failed' | 'stopped'

export interface GroupStatusPresentation {
  /** 整体展示阶段 */
  phase: GroupDisplayPhase
  /** 是否处于活跃状态（启动中或子服务正在运行） */
  isActive: boolean
  /** 列表徽标文字 */
  badgeText: string
  /** 指示圆点状态 */
  dotState: 'starting' | 'running' | 'failed' | 'done' | 'idle'
  /** 列表副标题文案 */
  summaryText: string
  /** 详情页主徽标文案 */
  detailBadgeText: string
  /** 详情页进度条提示文案 */
  progressHint: string
}

export interface ResolveGroupStatusOptions {
  group: Group
  state: GroupRunState | undefined
  active: ActiveGroup | undefined
  formatFinished?: (iso: string) => string
}

export function formatGroupFinished(iso: string): string {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

export function resolveGroupStatus({
  group,
  state,
  active,
  formatFinished = formatGroupFinished
}: ResolveGroupStatusOptions): GroupStatusPresentation {
  const isStarting = state?.status === 'running'
  const isRunning = Boolean(active && active.phase === 'running')
  const isReady = state?.status === 'ready'
  const isActive = isStarting || isRunning || isReady

  const phase: GroupDisplayPhase = isStarting
    ? 'starting'
    : isRunning
      ? 'running'
      : isReady
        ? 'ready'
        : state?.status === 'failed'
          ? 'failed'
          : state?.status === 'stopped'
            ? 'stopped'
            : state?.status === 'done'
              ? 'done'
              : 'idle'

  const totalSteps = state?.group?.steps.length ?? group.steps.length
  const completedSteps =
    state?.steps.filter((s) => s.state === 'done' || s.state === 'completed').length ?? 0
  const currentStepNum = Math.min(completedSteps + 1, Math.max(totalSteps, 1))

  let badgeText = ''
  switch (phase) {
    case 'starting':
      badgeText = '启动中'
      break
    case 'running':
      badgeText = active ? `运行中 ${active.current}/${active.total}` : '运行中'
      break
    case 'ready':
      badgeText = '已就绪'
      break
    case 'failed':
      badgeText = '失败'
      break
    case 'stopped':
      badgeText = '已停止'
      break
    case 'done':
      badgeText = '已完成'
      break
    case 'idle':
      badgeText = group.mode === 'parallel' ? '并行' : '串行'
      break
  }

  let dotState: GroupStatusPresentation['dotState'] = 'idle'
  switch (phase) {
    case 'starting':
      dotState = 'starting'
      break
    case 'running':
    case 'ready':
      dotState = 'running'
      break
    case 'failed':
      dotState = 'failed'
      break
    case 'done':
    case 'stopped':
      dotState = 'done'
      break
    case 'idle':
      dotState = 'idle'
      break
  }

  let summaryText = '未运行'
  switch (phase) {
    case 'starting':
      summaryText = '启动中'
      break
    case 'running':
      summaryText = active ? `${active.current}/${active.total} 个脚本运行中` : '运行中'
      break
    case 'ready':
      summaryText = '启动流程已完成'
      break
    case 'failed':
      summaryText = state?.steps?.find((s) => s.state === 'failed')?.message ?? '失败'
      break
    case 'stopped':
      summaryText = state?.finishedAt ? `已停止 · ${formatFinished(state.finishedAt)}` : '已停止'
      break
    case 'done':
      summaryText = state?.finishedAt ? `已完成 · ${formatFinished(state.finishedAt)}` : '已完成'
      break
    case 'idle':
      summaryText = '未运行'
      break
  }

  let detailBadgeText = '尚未执行'
  switch (phase) {
    case 'starting':
      detailBadgeText = `第 ${currentStepNum} / ${totalSteps} 步 · 启动中`
      break
    case 'running':
      detailBadgeText = active ? `运行中 · ${active.current}/${active.total} 个服务存活` : '运行中'
      break
    case 'ready':
      detailBadgeText = '已就绪'
      break
    case 'failed':
      detailBadgeText = '失败'
      break
    case 'stopped':
      detailBadgeText = '已停止'
      break
    case 'done':
      detailBadgeText = '已完成'
      break
    case 'idle':
      detailBadgeText = '尚未执行'
      break
  }

  let progressHint = '待执行'
  switch (phase) {
    case 'starting':
      progressHint = `正在执行第 ${currentStepNum} 步`
      break
    case 'running':
      progressHint = `全部步骤就绪 · ${active?.current ?? 0} 个服务运行中`
      break
    case 'ready':
      progressHint = '全部步骤就绪'
      break
    case 'failed':
      progressHint = '执行中断'
      break
    case 'stopped':
      progressHint = '已停止'
      break
    case 'done':
      progressHint = '全部步骤已完成'
      break
    case 'idle':
      progressHint = '待执行'
      break
  }

  return {
    phase,
    isActive,
    badgeText,
    dotState,
    summaryText,
    detailBadgeText,
    progressHint
  }
}
