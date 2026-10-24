import { describe, expect, it } from 'vitest'
import type { Project, Run } from './domain'
import { activeRunsOf, isProjectActive, sortProjects } from './projects'

const makeProject = (id: string, name: string, path = `/${name}`): Project => ({
  id,
  name,
  path,
  addedAt: '2026-01-01T00:00:00.000Z'
})

const makeRun = (
  id: string,
  projectId: string,
  status: Run['status'] = 'running',
  startedAt = '2026-01-01T00:00:00.000Z'
): Run => ({
  kind: 'script',
  id,
  projectId,
  scriptId: 'dev',
  title: 'dev',
  command: 'npm run dev',
  status,
  pid: 1234,
  exitCode: null,
  stopped: false,
  startedAt
})

describe('isProjectActive', () => {
  it('returns true when there is a running or stopping run', () => {
    const runs = [
      makeRun('r1', 'p1', 'running'),
      makeRun('r2', 'p2', 'stopping'),
      makeRun('r3', 'p3', 'exited')
    ]
    expect(isProjectActive('p1', runs)).toBe(true)
    expect(isProjectActive('p2', runs)).toBe(true)
    expect(isProjectActive('p3', runs)).toBe(false)
    expect(isProjectActive('p4', runs)).toBe(false)
  })
})

describe('activeRunsOf', () => {
  it('filters out exited runs and runs of other projects', () => {
    const runs = [
      makeRun('r1', 'p1', 'running'),
      makeRun('r2', 'p1', 'exited'),
      makeRun('r3', 'p2', 'running')
    ]
    expect(activeRunsOf('p1', runs)).toEqual([runs[0]])
  })
})

describe('sortProjects', () => {
  it('sorts inactive projects alphabetically by default (name then path)', () => {
    const pA = makeProject('1', 'alpha', '/a')
    const pB = makeProject('2', 'beta', '/b')
    const pB2 = makeProject('3', 'beta', '/a-beta')
    const pC = makeProject('4', 'charlie', '/c')

    const sorted = sortProjects([pC, pB, pB2, pA], [])
    expect(sorted.map((p) => p.id)).toEqual(['1', '3', '2', '4'])
  })

  it('ignores exited runs when deciding activity', () => {
    const pA = makeProject('1', 'alpha')
    const pB = makeProject('2', 'beta')
    const runs = [makeRun('r1', '2', 'exited', '2026-01-02T00:00:00.000Z')]

    const sorted = sortProjects([pB, pA], runs)
    expect(sorted.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('moves active projects to the front', () => {
    const pA = makeProject('1', 'alpha')
    const pB = makeProject('2', 'beta')
    const pC = makeProject('3', 'charlie')
    const runs = [makeRun('r1', '3', 'running')]

    const sorted = sortProjects([pA, pB, pC], runs)
    expect(sorted.map((p) => p.id)).toEqual(['3', '1', '2'])
  })

  it('orders multiple active projects by most recent start time', () => {
    const pA = makeProject('1', 'alpha')
    const pB = makeProject('2', 'beta')
    const pC = makeProject('3', 'charlie')
    const runs = [
      makeRun('r1', '1', 'running', '2026-01-01T10:00:00.000Z'),
      makeRun('r2', '2', 'running', '2026-01-01T12:00:00.000Z'),
      makeRun('r3', '1', 'running', '2026-01-01T11:00:00.000Z') // p1 latest is 11:00, p2 latest is 12:00
    ]

    const sorted = sortProjects([pA, pB, pC], runs)
    expect(sorted.map((p) => p.id)).toEqual(['2', '1', '3'])
  })

  it('breaks equal start time ties by number of active runs', () => {
    const pA = makeProject('1', 'alpha')
    const pB = makeProject('2', 'beta')
    const runs = [
      makeRun('r1', '1', 'running', '2026-01-01T10:00:00.000Z'),
      makeRun('r2', '2', 'running', '2026-01-01T10:00:00.000Z'),
      makeRun('r3', '2', 'running', '2026-01-01T09:00:00.000Z') // p2 has 2 active runs, same latest time
    ]

    const sorted = sortProjects([pA, pB], runs)
    expect(sorted.map((p) => p.id)).toEqual(['2', '1'])
  })

  it('uses custom secondary comparator when activity is equal', () => {
    const pA = makeProject('1', 'a-project', '/workspace/pkg-b')
    const pB = makeProject('2', 'b-project', '/workspace/pkg-a')

    // Inactive projects custom sorted by path
    const customSecondary = (a: Project, b: Project): number => a.path.localeCompare(b.path)
    const sorted = sortProjects([pA, pB], [], { secondary: customSecondary })
    expect(sorted.map((p) => p.id)).toEqual(['2', '1'])

    // Both active with same stats, broken by custom secondary
    const runs = [
      makeRun('r1', '1', 'running', '2026-01-01T10:00:00.000Z'),
      makeRun('r2', '2', 'running', '2026-01-01T10:00:00.000Z')
    ]
    const sortedActive = sortProjects([pA, pB], runs, { secondary: customSecondary })
    expect(sortedActive.map((p) => p.id)).toEqual(['2', '1'])
  })

  it('does not mutate the original array', () => {
    const original = [makeProject('2', 'b'), makeProject('1', 'a')]
    const shallow = [...original]
    sortProjects(original, [])
    expect(original).toEqual(shallow)
  })
})
