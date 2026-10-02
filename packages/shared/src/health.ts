import { z } from 'zod'

/**
 * Readiness of a running script (ADR 0011). `starting` until the first successful check,
 * `ready` while checks pass, `unhealthy` after several failures in a row once it was ready.
 */
export const healthStateSchema = z.enum(['starting', 'ready', 'unhealthy'])
export type HealthState = z.infer<typeof healthStateSchema>

export interface RunHealth {
  runId: string
  state: HealthState
  /** What is checked, for display: `端口 5173` or `GET http://localhost:8080/actuator/health`. */
  target: string
  /** When the current state began. */
  since: string
}

/** Path checked over HTTP on the script's first port, from `.devhub.yaml` (`health: /status`). */
export const healthPathSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/[^\s]*$/, '必须以 / 开头且不含空白')
