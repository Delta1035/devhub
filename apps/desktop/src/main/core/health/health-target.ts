import type { Script } from '@devhub/shared'

/** What decides a script's readiness: every port accepts connections, or an HTTP path answers 2xx. */
export type HealthTarget =
  { type: 'ports'; ports: number[] } | { type: 'http'; port: number; path: string }

export interface HealthCheckers {
  checkPort: (port: number) => Promise<boolean>
  checkHttp: (port: number, path: string) => Promise<boolean>
}

/** Null for scripts with nothing to check (no known port), which then show no readiness. */
export function healthTargetOf(script: Script): HealthTarget | null {
  const [first] = script.ports ?? []
  if (first === undefined) return null
  return script.healthPath
    ? { type: 'http', port: first, path: script.healthPath }
    : { type: 'ports', ports: script.ports ?? [] }
}

export function describeHealthTarget(target: HealthTarget): string {
  return target.type === 'http'
    ? `GET http://localhost:${target.port}${target.path}`
    : `端口 ${target.ports.join(', ')}`
}

export async function checkHealthTarget(
  target: HealthTarget,
  checkers: HealthCheckers
): Promise<boolean> {
  if (target.type === 'http') {
    return checkers.checkHttp(target.port, target.path).catch(() => false)
  }
  const open = await Promise.all(
    target.ports.map((port) => checkers.checkPort(port).catch(() => false))
  )
  return open.every(Boolean)
}
