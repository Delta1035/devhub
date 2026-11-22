import { describe, expect, it } from 'vitest'
import type { Run, Script } from './domain'
import { sortScripts } from './scripts'

const makeScript = (id: string, name: string, command = 'echo test'): Script => ({
  id,
  name,
  command,
  source: 'npm'
})

const makeRun = (
  id: string,
  projectId: string,
  scriptId: string,
  status: Run['status'],
  startedAt = '2026-01-01T00:00:00.000Z'
): Run => ({
  id,
  projectId,
  title: scriptId,
  kind: 'script',
  scriptId,
  command: 'echo test',
  status,
  pid: 1234,
  exitCode: status === 'exited' ? 0 : null,
  stopped: false,
  startedAt
})

describe('sortScripts', () => {
  const sA = makeScript('s1', 'build', 'vite build')
  const sB = makeScript('s2', 'dev', 'vite dev')
  const sC = makeScript('s3', 'test', 'vitest')

  it('keeps detector/configuration order by default', () => {
    const original = [sB, sC, sA]
    const sorted = sortScripts(original)
    expect(sorted.map((s) => s.id)).toEqual(['s2', 's3', 's1'])
    // does not mutate
    expect(sorted).not.toBe(original)
  })

  it('sorts alphabetically ascending by name', () => {
    const sorted = sortScripts([sB, sC, sA], { order: 'name-asc' })
    expect(sorted.map((s) => s.name)).toEqual(['build', 'dev', 'test'])
  })

  it('sorts alphabetically descending by name', () => {
    const sorted = sortScripts([sB, sA, sC], { order: 'name-desc' })
    expect(sorted.map((s) => s.name)).toEqual(['test', 'dev', 'build'])
  })

  it('sorts active scripts first when order is active-first', () => {
    const runs: Run[] = [
      makeRun('r1', 'p1', 's2', 'running', '2026-01-01T10:00:00.000Z'),
      makeRun('r2', 'p1', 's3', 'running', '2026-01-01T12:00:00.000Z'),
      makeRun('r3', 'p1', 's1', 'exited', '2026-01-01T14:00:00.000Z')
    ]

    const sorted = sortScripts([sA, sB, sC], {
      order: 'active-first',
      runs,
      projectId: 'p1'
    })

    // s3 started at 12:00 (active), s2 started at 10:00 (active), s1 is exited (inactive)
    expect(sorted.map((s) => s.id)).toEqual(['s3', 's2', 's1'])
  })

  it('breaks equal active status ties by name', () => {
    const sorted = sortScripts([sC, sB, sA], {
      order: 'active-first',
      runs: [],
      projectId: 'p1'
    })
    // No active runs -> sorted by name
    expect(sorted.map((s) => s.name)).toEqual(['build', 'dev', 'test'])
  })
})
