import { describe, expect, it } from 'vitest'
import type { Script } from '@devhub/shared'
import {
  checkHealthTarget,
  describeHealthTarget,
  healthTargetOf,
  type HealthTarget
} from './health-target'

const script = (overrides: Partial<Script> = {}): Script => ({
  id: 'npm:dev',
  name: 'dev',
  source: 'npm',
  command: 'vite',
  ...overrides
})

describe('healthTargetOf', () => {
  it('checks the ports, or an HTTP path on the first port, and nothing without a port', () => {
    expect(healthTargetOf(script({ ports: [5173, 24678] }))).toEqual({
      type: 'ports',
      ports: [5173, 24678]
    })
    expect(healthTargetOf(script({ ports: [8080, 9090], healthPath: '/actuator/health' }))).toEqual(
      { type: 'http', port: 8080, path: '/actuator/health' }
    )
    expect(healthTargetOf(script())).toBeNull()
    expect(healthTargetOf(script({ ports: [] }))).toBeNull()
  })

  it('describes the target for display', () => {
    expect(describeHealthTarget({ type: 'ports', ports: [5173, 24678] })).toBe('端口 5173, 24678')
    expect(describeHealthTarget({ type: 'http', port: 8080, path: '/health' })).toBe(
      'GET http://localhost:8080/health'
    )
  })
})

describe('checkHealthTarget', () => {
  const checkers = (open: number[], healthy: string[] = []) => ({
    checkPort: async (port: number) => open.includes(port),
    checkHttp: async (port: number, path: string) => healthy.includes(`${port}${path}`)
  })

  it('needs every port to accept connections', async () => {
    const target: HealthTarget = { type: 'ports', ports: [3000, 3001] }
    await expect(checkHealthTarget(target, checkers([3000, 3001]))).resolves.toBe(true)
    await expect(checkHealthTarget(target, checkers([3000]))).resolves.toBe(false)
  })

  it('needs the HTTP path to answer 2xx', async () => {
    const target = { type: 'http', port: 8080, path: '/health' } as const
    await expect(checkHealthTarget(target, checkers([8080], ['8080/health']))).resolves.toBe(true)
    await expect(checkHealthTarget(target, checkers([8080]))).resolves.toBe(false)
  })

  it('counts a failing checker as not ready', async () => {
    const failing = {
      checkPort: () => Promise.reject(new Error('boom')),
      checkHttp: () => Promise.reject(new Error('boom'))
    }
    await expect(checkHealthTarget({ type: 'ports', ports: [1] }, failing)).resolves.toBe(false)
    await expect(checkHealthTarget({ type: 'http', port: 1, path: '/' }, failing)).resolves.toBe(
      false
    )
  })
})
