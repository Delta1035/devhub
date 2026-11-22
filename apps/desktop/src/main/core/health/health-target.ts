import type { Script } from '@devhub/shared'

/** What decides a script's readiness: ports accept connections, HTTP path answers 2xx, output matches pattern, or process stays alive. */
export type HealthTarget =
  | { type: 'ports'; ports: number[] }
  | { type: 'http'; port: number; path: string }
  | { type: 'alive'; delayMs?: number }
  | { type: 'output'; pattern: string; regex?: boolean }

export interface HealthCheckers {
  checkPort: (port: number) => Promise<boolean>
  checkHttp: (port: number, path: string) => Promise<boolean>
  checkAlive?: (runId: string) => Promise<boolean>
  checkOutput?: (runId: string, pattern: string, regex?: boolean) => Promise<boolean>
}

export interface HealthCheckContext {
  runId?: string
  startedAt?: string
  now?: Date
}

/** Determines what to check for a script. Defaults to alive check when no port is configured. */
export function healthTargetOf(script: Script): HealthTarget {
  if (script.healthConfig) {
    if (script.healthConfig.type === 'http') {
      const port = script.healthConfig.port ?? script.ports?.[0]
      if (port !== undefined) {
        return { type: 'http', port, path: script.healthConfig.path }
      }
    } else if (script.healthConfig.type === 'output') {
      return {
        type: 'output',
        pattern: script.healthConfig.pattern,
        regex: script.healthConfig.regex
      }
    } else if (script.healthConfig.type === 'ports') {
      return { type: 'ports', ports: script.healthConfig.ports }
    } else if (script.healthConfig.type === 'alive') {
      return { type: 'alive', delayMs: script.healthConfig.delayMs }
    }
  }

  const [first] = script.ports ?? []
  if (first !== undefined) {
    return script.healthPath
      ? { type: 'http', port: first, path: script.healthPath }
      : { type: 'ports', ports: script.ports ?? [] }
  }

  return { type: 'alive', delayMs: 2000 }
}

export function describeHealthTarget(target: HealthTarget): string {
  if (target.type === 'http') {
    return `GET http://localhost:${target.port}${target.path}`
  }
  if (target.type === 'ports') {
    return `端口 ${target.ports.join(', ')}`
  }
  if (target.type === 'output') {
    return `输出包含「${target.pattern}」`
  }
  return '进程稳定运行'
}

export async function checkHealthTarget(
  target: HealthTarget,
  checkers: HealthCheckers,
  context?: HealthCheckContext
): Promise<boolean> {
  if (target.type === 'http') {
    return checkers.checkHttp(target.port, target.path).catch(() => false)
  }
  if (target.type === 'ports') {
    const open = await Promise.all(
      target.ports.map((port) => checkers.checkPort(port).catch(() => false))
    )
    return open.every(Boolean)
  }
  if (target.type === 'output') {
    if (!context?.runId || !checkers.checkOutput) return false
    return checkers.checkOutput(context.runId, target.pattern, target.regex).catch(() => false)
  }
  if (target.type === 'alive') {
    const delay = target.delayMs ?? 2000
    if (context?.startedAt) {
      const elapsed = (context.now?.getTime() ?? Date.now()) - Date.parse(context.startedAt)
      if (elapsed < delay) return false
    }
    if (context?.runId && checkers.checkAlive) {
      return checkers.checkAlive(context.runId).catch(() => false)
    }
    return true
  }
  return false
}
