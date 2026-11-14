import type { ContinueCondition, GroupStepState } from './groups'

export function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms) || ms < 0) return '—'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 1) return '< 1s'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSec}s`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m`
}

export function describeCondition(condition: ContinueCondition): string {
  switch (condition.type) {
    case 'delay':
      return `等待 ${condition.seconds} 秒`
    case 'exit':
      return `进程成功退出 · 超时 ${condition.timeoutSeconds} 秒`
    case 'output':
      return `输出${condition.regex ? '匹配正则' : '出现文字'}「${condition.text}」 · 超时 ${condition.timeoutSeconds} 秒`
    case 'port':
      return `端口 ${condition.port} 可连接 · 超时 ${condition.timeoutSeconds} 秒`
    case 'http':
      return `HTTP 返回成功：${condition.url} · 超时 ${condition.timeoutSeconds} 秒`
  }
}

export interface ConditionBadgeInfo {
  text: string
  timeoutText: string
}

export function getConditionBadge(condition: ContinueCondition): ConditionBadgeInfo {
  switch (condition.type) {
    case 'delay':
      return { text: `等待 ${condition.seconds}s`, timeoutText: '' }
    case 'exit':
      return { text: '进程退出码 0', timeoutText: `超时 ${condition.timeoutSeconds}s` }
    case 'output':
      return {
        text: condition.regex ? `正则 /${condition.text}/` : `包含 "${condition.text}"`,
        timeoutText: `超时 ${condition.timeoutSeconds}s`
      }
    case 'port':
      return { text: `端口 ${condition.port}`, timeoutText: `超时 ${condition.timeoutSeconds}s` }
    case 'http':
      return { text: `HTTP 200 ${condition.url}`, timeoutText: `超时 ${condition.timeoutSeconds}s` }
  }
}

export const stepStateLabels: Record<GroupStepState, string> = {
  pending: '等待启动',
  running: '启动中',
  done: '条件满足',
  failed: '失败',
  cancelled: '已取消'
}
