import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import type { Project, Workspace } from '@devhub/shared'
import type { ScanResult } from './workspace-scanner'
import { planSync, type PlanSyncInput } from './workspace-sync'

const root = resolve('/code')
const at = (name: string): string => join(root, name)

const workspace: Workspace = {
  id: 'ws',
  name: 'code',
  path: root,
  depth: 1,
  excluded: [],
  addedAt: '2026-10-04T00:00:00.000Z'
}

/** `null` makes a project added by hand. */
const project = (name: string, workspaceId: string | null = 'ws'): Project => ({
  id: name,
  name,
  path: at(name),
  addedAt: '2026-10-04T00:00:00.000Z',
  ...(workspaceId && { workspaceId })
})

const ok = (names: string[], complete = true): ScanResult => ({
  status: 'ok',
  projects: names.map(at),
  complete,
  warnings: []
})

const plan = (overrides: Partial<PlanSyncInput>) =>
  planSync({
    workspace,
    scan: ok([]),
    projects: [],
    platform: 'linux',
    isActive: () => false,
    isDirectory: async () => true,
    ...overrides
  })

describe('planSync', () => {
  it('adds newly found projects and keeps those still found', async () => {
    const result = await plan({ scan: ok(['a', 'b']), projects: [project('a')] })
    expect(result).toEqual({ add: [at('b')], remove: [] })
  })

  it('does not add excluded paths or directories that are already projects', async () => {
    const result = await plan({
      workspace: { ...workspace, excluded: [at('gone').toUpperCase()] },
      scan: ok(['gone', 'manual', 'other']),
      projects: [project('manual', null), project('other', 'another-workspace')],
      platform: 'win32'
    })
    expect(result.add).toEqual([])
  })

  it('removes projects that exist but no longer qualify', async () => {
    const result = await plan({ scan: ok([]), projects: [project('a')] })
    expect(result.remove).toEqual([project('a')])
  })

  it('keeps projects whose directory is gone, so their history survives', async () => {
    const result = await plan({
      scan: ok([]),
      projects: [project('a'), project('b')],
      isDirectory: async (path) => {
        if (path === at('b')) throw new Error('EIO')
        return false
      }
    })
    expect(result.remove).toEqual([])
  })

  it('keeps running projects and everything after an incomplete scan', async () => {
    const running = await plan({
      scan: ok([]),
      projects: [project('a')],
      isActive: (id) => id === 'a'
    })
    expect(running.remove).toEqual([])

    const incomplete = await plan({ scan: ok(['b'], false), projects: [project('a')] })
    expect(incomplete).toEqual({ add: [at('b')], remove: [] })
  })

  it('always removes projects the user excluded, even while running', async () => {
    const result = await plan({
      workspace: { ...workspace, excluded: [at('a')] },
      scan: ok(['a']),
      projects: [project('a')],
      isActive: () => true
    })
    expect(result).toEqual({ add: [], remove: [project('a')] })
  })

  it('never touches projects of other workspaces or added by hand', async () => {
    const result = await plan({
      scan: ok([]),
      projects: [project('manual', null), project('other', 'another-workspace')]
    })
    expect(result.remove).toEqual([])
  })

  it('changes nothing when the root is unavailable', async () => {
    const result = await plan({
      scan: { status: 'unavailable', reason: '目录不存在' },
      projects: [project('a')]
    })
    expect(result).toEqual({ add: [], remove: [] })
  })
})
