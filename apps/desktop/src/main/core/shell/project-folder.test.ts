import { describe, expect, it, vi } from 'vitest'
import type { Project } from '@devhub/shared'
import { resolveProjectFolder } from './project-folder'

const project: Project = {
  id: 'p1',
  name: 'web',
  path: '/code/web',
  addedAt: '2026-10-05T00:00:00.000Z'
}

const deps = (isDirectory = true) => ({
  listProjects: vi.fn(async () => [project]),
  isDirectory: vi.fn(async () => isDirectory)
})

describe('resolveProjectFolder', () => {
  it('returns the registered path of the project', async () => {
    const d = deps()
    await expect(resolveProjectFolder('p1', d)).resolves.toBe('/code/web')
    expect(d.isDirectory).toHaveBeenCalledWith('/code/web')
  })

  it.each([['unknown'], [''], [42], [null], [{ id: 'p1' }]])('rejects id %s', async (id) => {
    await expect(resolveProjectFolder(id, deps())).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND'
    })
  })

  it('rejects a project whose directory is gone', async () => {
    await expect(resolveProjectFolder('p1', deps(false))).rejects.toMatchObject({
      code: 'PROJECT_PATH_NOT_FOUND'
    })
  })
})
