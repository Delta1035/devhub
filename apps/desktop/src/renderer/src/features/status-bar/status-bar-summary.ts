import type { Project, Run, RunHealth } from '@devhub/shared'

export type HealthProbeKind = 'port' | 'http' | 'output' | 'alive' | 'other'

export interface ParsedHealthTarget {
  kind: HealthProbeKind
  ports: string[]
  raw: string
}

export interface StatusBarHealthItem {
  runId: string
  state: RunHealth['state']
  target: string
  kind: HealthProbeKind
  ports: string[]
  projectName: string
  scriptTitle: string
  pid: number | null
  run: Run | null
}

export interface StatusBarSummary {
  activeCount: number
  failedRun: Run | null
  failedProjectName: string | null
  healthItems: StatusBarHealthItem[]
  counts: {
    total: number
    ready: number
    starting: number
    unhealthy: number
  }
  readyPorts: string[]
  visiblePorts: string[]
  overflowPortCount: number
  readyNonPortCount: number
  triggerLabel: string
}

const STATE_PRIORITY: Record<RunHealth['state'], number> = {
  unhealthy: 0,
  starting: 1,
  ready: 2
}

const MAX_VISIBLE_PORTS = 3

/** Parses a `RunHealth.target` string produced by `describeHealthTarget` into structured probe metadata. */
export function parseHealthTarget(target: string): ParsedHealthTarget {
  const trimmed = target.trim()

  const httpMatch = /^GET\s+https?:\/\/[^:/\s]+:(\d+)/i.exec(trimmed)
  if (httpMatch?.[1]) {
    return { kind: 'http', ports: [httpMatch[1]], raw: trimmed }
  }

  if (trimmed.startsWith('端口 ')) {
    const ports = trimmed
      .slice('端口 '.length)
      .split(',')
      .map((part) => part.trim())
      .filter((part) => /^\d+$/.test(part))
    return { kind: 'port', ports, raw: trimmed }
  }

  if (trimmed.startsWith('输出包含「')) {
    return { kind: 'output', ports: [], raw: trimmed }
  }

  if (trimmed === '进程稳定运行') {
    return { kind: 'alive', ports: [], raw: trimmed }
  }

  return { kind: 'other', ports: [], raw: trimmed }
}

function pickLatestFailedRun(runs: Run[]): Run | null {
  let latest: Run | null = null
  let latestTs = -Infinity

  for (const run of runs) {
    if (run.status !== 'exited' || run.stopped || run.exitCode === 0) continue
    const ts = Date.parse(run.endedAt ?? run.startedAt)
    const normalizedTs = Number.isNaN(ts) ? 0 : ts
    if (!latest || normalizedTs >= latestTs) {
      latest = run
      latestTs = normalizedTs
    }
  }

  return latest
}

/** Builds structured, bounded status bar summary data from runs, health probes, and projects. */
export function buildStatusBarSummary(params: {
  runs: Run[]
  health: RunHealth[]
  projects: Project[]
  maxVisiblePorts?: number
}): StatusBarSummary {
  const { runs, health, projects, maxVisiblePorts = MAX_VISIBLE_PORTS } = params
  const runById = new Map(runs.map((run) => [run.id, run]))
  const projectById = new Map(projects.map((project) => [project.id, project]))

  const activeCount = runs.filter((run) => run.status !== 'exited').length
  const failedRun = pickLatestFailedRun(runs)
  const failedProjectName = failedRun
    ? (projectById.get(failedRun.projectId)?.name ?? '未知项目')
    : null

  const healthItems: StatusBarHealthItem[] = []
  for (const entry of health) {
    const run = runById.get(entry.runId) ?? null
    if (run && run.status === 'exited') continue
    const parsed = parseHealthTarget(entry.target)
    const projectName = run ? (projectById.get(run.projectId)?.name ?? '未知项目') : '未知项目'
    const scriptTitle = run ? run.title : '未知脚本'

    healthItems.push({
      runId: entry.runId,
      state: entry.state,
      target: entry.target,
      kind: parsed.kind,
      ports: parsed.ports,
      projectName,
      scriptTitle,
      pid: run ? run.pid : null,
      run
    })
  }

  healthItems.sort((a, b) => {
    const stateDiff = STATE_PRIORITY[a.state] - STATE_PRIORITY[b.state]
    if (stateDiff !== 0) return stateDiff
    const projectDiff = a.projectName.localeCompare(b.projectName, 'zh-CN')
    if (projectDiff !== 0) return projectDiff
    return a.scriptTitle.localeCompare(b.scriptTitle, 'zh-CN')
  })

  const readyItems = healthItems.filter((item) => item.state === 'ready')
  const startingCount = healthItems.filter((item) => item.state === 'starting').length
  const unhealthyCount = healthItems.filter((item) => item.state === 'unhealthy').length

  const portSet = new Set<string>()
  let readyNonPortCount = 0
  for (const item of readyItems) {
    if (item.ports.length > 0) {
      for (const port of item.ports) portSet.add(port)
    } else {
      readyNonPortCount += 1
    }
  }

  const readyPorts = [...portSet].sort((a, b) => Number(a) - Number(b))
  const visiblePorts = readyPorts.slice(0, maxVisiblePorts)
  const overflowPortCount = Math.max(0, readyPorts.length - visiblePorts.length)

  const triggerLabel = formatTriggerLabel({
    total: healthItems.length,
    ready: readyItems.length,
    starting: startingCount,
    unhealthy: unhealthyCount,
    visiblePorts,
    overflowPortCount,
    readyNonPortCount
  })

  return {
    activeCount,
    failedRun,
    failedProjectName,
    healthItems,
    counts: {
      total: healthItems.length,
      ready: readyItems.length,
      starting: startingCount,
      unhealthy: unhealthyCount
    },
    readyPorts,
    visiblePorts,
    overflowPortCount,
    readyNonPortCount,
    triggerLabel
  }
}

function formatTriggerLabel(input: {
  total: number
  ready: number
  starting: number
  unhealthy: number
  visiblePorts: string[]
  overflowPortCount: number
  readyNonPortCount: number
}): string {
  const { total, ready, starting, unhealthy, visiblePorts, overflowPortCount, readyNonPortCount } =
    input
  if (total === 0) return ''

  const portPart =
    visiblePorts.length > 0
      ? `端口 ${visiblePorts.join(' · ')}${overflowPortCount > 0 ? ` +${overflowPortCount}` : ''}`
      : ''

  if (unhealthy > 0) {
    const parts = [`${unhealthy} 个无响应`]
    if (portPart) {
      parts.push(portPart)
    } else if (ready > 0) {
      parts.push(`${ready} 项就绪`)
    }
    return parts.join(' · ')
  }

  if (portPart) {
    const parts = [`${portPart} 就绪`]
    if (readyNonPortCount > 0) parts.push(`${readyNonPortCount} 项稳定`)
    if (starting > 0) parts.push(`${starting} 启动中`)
    return parts.join(' · ')
  }

  if (ready > 0 && starting > 0) {
    return `${ready} 项稳定 · ${starting} 启动中`
  }
  if (ready > 0) {
    return `${ready} 项稳定运行`
  }
  return `${starting} 项启动检查中`
}
