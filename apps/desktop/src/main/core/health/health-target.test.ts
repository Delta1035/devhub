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
  it('checks the ports, an HTTP path on the first port, or falls back to alive check', () => {
    expect(healthTargetOf(script({ ports: [5173, 24678] }))).toEqual({
      type: 'ports',
      ports: [5173, 24678]
    })
    expect(healthTargetOf(script({ ports: [8080, 9090], healthPath: '/actuator/health' }))).toEqual(
      { type: 'http', port: 8080, path: '/actuator/health' }
    )
    expect(healthTargetOf(script())).toEqual({ type: 'alive', delayMs: 2000 })
    expect(healthTargetOf(script({ ports: [] }))).toEqual({ type: 'alive', delayMs: 2000 })
  })

  it('respects custom healthConfig', () => {
    expect(
      healthTargetOf(
        script({
          healthConfig: { type: 'output', pattern: 'Compiled successfully', regex: false }
        })
      )
    ).toEqual({
      type: 'output',
      pattern: 'Compiled successfully',
      regex: false
    })
    expect(healthTargetOf(script({ healthConfig: { type: 'alive', delayMs: 3000 } }))).toEqual({
      type: 'alive',
      delayMs: 3000
    })
  })

  it('describes the target for display', () => {
    expect(describeHealthTarget({ type: 'ports', ports: [5173, 24678] })).toBe('端口 5173, 24678')
    expect(describeHealthTarget({ type: 'http', port: 8080, path: '/health' })).toBe(
      'GET http://localhost:8080/health'
    )
    expect(describeHealthTarget({ type: 'output', pattern: 'Ready' })).toBe('输出包含「Ready」')
    expect(describeHealthTarget({ type: 'alive' })).toBe('进程稳定运行')
  })
})

describe('checkHealthTarget', () => {
  const checkers = (open: number[], healthy: string[] = []) => ({
    checkPort: async (port: number) => open.includes(port),
    checkHttp: async (port: number, path: string) => healthy.includes(`${port}${path}`),
    checkAlive: async () => true,
    checkOutput: async (_id: string, pattern: string) => pattern === 'ready'
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

  it('checks output pattern matching', async () => {
    const target = { type: 'output', pattern: 'ready' } as const
    await expect(checkHealthTarget(target, checkers([], []), { runId: 'r1' })).resolves.toBe(true)
    await expect(
      checkHealthTarget({ type: 'output', pattern: 'other' }, checkers([], []), { runId: 'r1' })
    ).resolves.toBe(false)
  })

  it('checks alive target with delay', async () => {
    const target: HealthTarget = { type: 'alive', delayMs: 1000 }
    const now = new Date('2026-11-22T20:00:02.000Z')
    // Elapsed 2000 >= 1000 -> ready
    await expect(
      checkHealthTarget(target, checkers([], []), {
        runId: 'r1',
        startedAt: '2026-11-22T20:00:00.000Z',
        now
      })
    ).resolves.toBe(true)

    // Elapsed 500 < 1000 -> not ready
    await expect(
      checkHealthTarget(target, checkers([], []), {
        runId: 'r1',
        startedAt: '2026-11-22T20:00:01.500Z',
        now
      })
    ).resolves.toBe(false)
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
