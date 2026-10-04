import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DevhubErrorCode } from '@devhub/shared'
import { createJsonStore } from '../storage/json-store'
import { createProjectService, emptyProjectsFile, projectsFileSchema } from './project-service'

describe('createProjectService', () => {
  let dir: string
  let repoA: string
  let storePath: string
  let idCounter = 0

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-projects-'))
    repoA = join(dir, 'repo-a')
    await mkdir(repoA)
    storePath = join(dir, 'data', 'projects.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const makeService = (platform: NodeJS.Platform = 'linux') =>
    createProjectService({
      store: createJsonStore({
        filePath: storePath,
        schema: projectsFileSchema,
        fallback: emptyProjectsFile
      }),
      platform,
      now: () => new Date('2026-10-02T00:00:00.000Z'),
      newId: () => `id-${++idCounter}`
    })

  const expectCode = (promise: Promise<unknown>, code: DevhubErrorCode) =>
    expect(promise).rejects.toMatchObject({ code })

  it('starts empty', async () => {
    await expect(makeService().list()).resolves.toEqual([])
  })

  it('adds a directory using its folder name and persists it', async () => {
    const project = await makeService().add(repoA)
    expect(project).toMatchObject({
      name: 'repo-a',
      path: repoA,
      addedAt: '2026-10-02T00:00:00.000Z'
    })
    await expect(makeService().list()).resolves.toEqual([project])
  })

  it('normalizes the path before storing it', async () => {
    const project = await makeService().add(join(repoA, '..', 'repo-a') + '/')
    expect(project.path).toBe(repoA)
  })

  it('rejects duplicates', async () => {
    const service = makeService()
    await service.add(repoA)
    await expectCode(service.add(repoA), 'PROJECT_ALREADY_ADDED')
  })

  it('treats paths case-insensitively on Windows', async () => {
    const service = makeService('win32')
    await service.add(repoA)
    await expectCode(service.add(repoA.toUpperCase()), 'PROJECT_ALREADY_ADDED')
  })

  it.each([
    ['empty input', ''],
    ['non-string input', 42],
    ['relative path', 'repo-a']
  ])('rejects %s', async (_label, input) => {
    await expectCode(makeService().add(input), 'INVALID_INPUT')
  })

  it('rejects missing directories and plain files', async () => {
    const file = join(dir, 'file.txt')
    await writeFile(file, 'x')
    const service = makeService()
    await expectCode(service.add(join(dir, 'missing')), 'PROJECT_PATH_NOT_FOUND')
    await expectCode(service.add(file), 'PROJECT_PATH_NOT_DIRECTORY')
  })

  it('removes a project and persists the removal', async () => {
    const service = makeService()
    const project = await service.add(repoA)
    await service.remove(project.id)
    await expect(makeService().list()).resolves.toEqual([])
    await expectCode(service.remove(project.id), 'PROJECT_NOT_FOUND')
  })

  it('gets a project by id and rejects unknown or malformed ids', async () => {
    const service = makeService()
    const project = await service.add(repoA)
    await expect(service.get(project.id)).resolves.toEqual(project)
    await expectCode(service.get('nope'), 'PROJECT_NOT_FOUND')
    await expectCode(service.get(42), 'PROJECT_NOT_FOUND')
  })

  it('adds discovered directories with their workspace and skips existing paths', async () => {
    const service = makeService('win32')
    const manual = await service.add(repoA)
    const repoB = join(dir, 'repo-b')

    const added = await service.addDiscovered([repoA.toUpperCase(), repoB], 'ws-1')

    expect(added).toEqual([
      {
        id: expect.any(String),
        name: 'repo-b',
        path: repoB,
        addedAt: expect.any(String),
        workspaceId: 'ws-1'
      }
    ])
    await expect(makeService().list()).resolves.toEqual([manual, ...added])
  })

  it('removes several projects in one call and ignores unknown ids', async () => {
    const service = makeService()
    const [a, b, c] = await service.addDiscovered(
      ['a', 'b', 'c'].map((name) => join(dir, name)),
      'ws-1'
    )
    await expect(service.removeMany([a!.id, c!.id, 'nope'])).resolves.toEqual([a, c])
    await expect(makeService().list()).resolves.toEqual([b])
  })

  it('does not lose updates when adds run concurrently', async () => {
    const repos = await Promise.all(
      ['x', 'y', 'z'].map(async (name) => {
        const path = join(dir, name)
        await mkdir(path)
        return path
      })
    )
    const service = makeService()
    await Promise.all(repos.map((path) => service.add(path)))
    await expect(makeService().list()).resolves.toHaveLength(3)
  })
})
