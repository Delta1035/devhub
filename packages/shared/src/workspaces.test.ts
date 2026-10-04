import { describe, expect, it } from 'vitest'
import {
  defaultWorkspaceDepth,
  workspaceDepthMax,
  workspaceDepthMin,
  workspaceDepthSchema,
  workspaceSchema
} from './workspaces'

describe('workspace contracts', () => {
  it('accepts depths from 1 to 5 and defaults to direct children', () => {
    expect(defaultWorkspaceDepth).toBe(1)
    for (let depth = workspaceDepthMin; depth <= workspaceDepthMax; depth++) {
      expect(workspaceDepthSchema.safeParse(depth).success).toBe(true)
    }
    for (const depth of [0, 6, 1.5, '2']) {
      expect(workspaceDepthSchema.safeParse(depth).success).toBe(false)
    }
  })

  it('requires the excluded list and a valid depth', () => {
    const workspace = {
      id: 'w',
      name: 'code',
      path: '/home/me/code',
      depth: 2,
      excluded: ['/home/me/code/old'],
      addedAt: '2026-10-04T10:00:00.000Z'
    }
    expect(workspaceSchema.parse(workspace)).toEqual(workspace)
    expect(workspaceSchema.safeParse({ ...workspace, excluded: undefined }).success).toBe(false)
    expect(workspaceSchema.safeParse({ ...workspace, depth: 9 }).success).toBe(false)
  })
})
