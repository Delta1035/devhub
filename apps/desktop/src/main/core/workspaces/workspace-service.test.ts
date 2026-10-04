import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DevhubErrorCode, DevhubEvent } from '@devhub/shared'
import { isDirectory } from '../fs/is-directory'
import {
  createProjectService,
  emptyProjectsFile,
  projectsFileSchema
} from '../projects/project-service'
import { createJsonStore } from '../storage/json-store'
import { scanWorkspace, type ScanResult } from './workspace-scanner'
import {
  createWorkspaceService,
  emptyWorkspacesFile,
  workspacesFileSchema
} from './workspace-service'

describe('createWorkspaceService', () => {
  let dir: string
  let code: string
  let events: DevhubEvent[]
  let forgotten: string[]
  let active: Set<string>
  let scanOverride: ScanResult | null
  let scanCount: number
  let idCounter = 0

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-workspaces-'))
    code = join(dir, 'code')
    await mkdir(code)
    events = []
    forgotten = []
    active = new Set()
    scanOverride = null
    scanCount = 0
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const projectDir = async (name: string, root = code): Promise<string> => {
    await mkdir(join(root, name), { recursive: true })
    await writeFile(join(root, name, 'package.json'), '{}')
    return join(root, name)
  }

  const makeServices = (platform: NodeJS.Platform = 'linux') => {
    const projects = createProjectService({
      store: createJsonStore({
        filePath: join(dir, 'data', 'projects.json'),
        schema: projectsFileSchema,
        fallback: emptyProjectsFile
      }),
      platform,
      newId: () => `p-${++idCounter}`
    })
    const workspaces = createWorkspaceService({
      store: createJsonStore({
        filePath: join(dir, 'data', 'workspaces.json'),
        schema: workspacesFileSchema,
        fallback: emptyWorkspacesFile
      }),
      projects,
      platform,
      scan: async (root, depth) => {
        scanCount++
        return scanOverride ?? scanWorkspace(root, { depth })
      },
      isActive: (id) => active.has(id),
      isDirectory,
      forgetProject: async (id) => {
        forgotten.push(id)
      },
      emit: (event) => events.push(event),
      now: () => new Date('2026-10-04T00:00:00.000Z'),
      newId: () => `w-${++idCounter}`
    })
    return { projects, workspaces }
  }

  const expectCode = (promise: Promise<unknown>, code: DevhubErrorCode) =>
    expect(promise).rejects.toMatchObject({ code })

  const only = <T>(items: T[]): T => {
    expect(items).toHaveLength(1)
    return items[0]!
  }

  const paths = async (projects: ReturnType<typeof makeServices>['projects']) =>
    (await projects.list()).map((project) => project.path)

  it('adds a workspace with depth 1 and registers the projects found in it', async () => {
    const web = await projectDir('web')
    await projectDir('group/nested')
    const { projects, workspaces } = makeServices()

    const workspace = await workspaces.add(code)

    expect(workspace).toMatchObject({
      name: 'code',
      path: code,
      depth: 1,
      excluded: [],
      scan: { available: true, complete: true, warnings: [] }
    })
    await expect(projects.list()).resolves.toEqual([
      expect.objectContaining({ name: 'web', path: web, workspaceId: workspace.id })
    ])
    expect(events).toEqual([{ type: 'projects-updated' }])
    // Persisted: a new session sees the workspace, though not yet its scan.
    await expect(makeServices().workspaces.list()).resolves.toEqual([{ ...workspace, scan: null }])
  })

  it('rescans deeper after the depth is raised and drops projects when it is lowered', async () => {
    await projectDir('web')
    const nested = await projectDir('group/nested')
    const { projects, workspaces } = makeServices()
    const workspace = await workspaces.add(code)

    await workspaces.update(workspace.id, { depth: 2 })
    expect(await paths(projects)).toContain(nested)

    await workspaces.update(workspace.id, { depth: 1 })
    expect(await paths(projects)).not.toContain(nested)
    expect(forgotten).toHaveLength(1)
  })

  it('picks up new projects and keeps deleted ones as missing on rescan', async () => {
    const web = await projectDir('web')
    const { projects, workspaces } = makeServices()
    await workspaces.add(code)
    events = []

    const api = await projectDir('api')
    await rm(web, { recursive: true })
    await workspaces.rescanAll()

    expect(await paths(projects)).toEqual([web, api])
    expect(events).toEqual([{ type: 'projects-updated' }])

    events = []
    await workspaces.rescanAll()
    expect(events).toEqual([])
  })

  it('keeps projects that stopped qualifying while they are running', async () => {
    const web = await projectDir('web')
    const { projects, workspaces } = makeServices()
    await workspaces.add(code)
    const project = only(await projects.list())
    active.add(project.id)

    await rm(join(web, 'package.json'))
    await workspaces.rescanAll()
    expect(await paths(projects)).toEqual([web])

    active.clear()
    await workspaces.rescanAll()
    expect(await paths(projects)).toEqual([])
  })

  it('leaves projects alone when the root is unavailable and reports why', async () => {
    await projectDir('web')
    const { projects, workspaces } = makeServices()
    await workspaces.add(code)
    scanOverride = { status: 'unavailable', reason: '目录不存在' }

    const view = only(await workspaces.rescanAll())

    expect(view.scan).toMatchObject({ available: false, warnings: ['无法扫描：目录不存在'] })
    await expect(projects.list()).resolves.toHaveLength(1)
  })

  it('excludes a removed discovered project and restores it when un-excluded', async () => {
    const web = await projectDir('web')
    const { projects, workspaces } = makeServices()
    const workspace = await workspaces.add(code)
    const project = only(await projects.list())

    await workspaces.removeProject(project.id)
    const afterRemove = only(await workspaces.rescanAll())

    expect(afterRemove.excluded).toEqual([web])
    expect(await paths(projects)).toEqual([])
    expect(forgotten).toEqual([project.id])

    await workspaces.update(workspace.id, { excluded: [] })
    expect(await paths(projects)).toEqual([web])
  })

  it('keeps a hand-added project inside the workspace and excludes it once removed', async () => {
    const web = await projectDir('web')
    const { projects, workspaces } = makeServices()
    const manual = await projects.add(web)

    const workspace = await workspaces.add(code)
    await expect(projects.list()).resolves.toEqual([manual])

    await workspaces.removeProject(manual.id)
    await workspaces.rescanAll()
    expect(await paths(projects)).toEqual([])
    await expect(workspaces.list()).resolves.toMatchObject([{ id: workspace.id, excluded: [web] }])
  })

  it('removes a project outside every workspace without touching workspaces', async () => {
    const elsewhere = await projectDir('elsewhere', dir)
    const { projects, workspaces } = makeServices()
    await workspaces.add(code)
    const manual = await projects.add(elsewhere)
    events = []

    await workspaces.removeProject(manual.id)

    await expect(workspaces.list()).resolves.toMatchObject([{ excluded: [] }])
    expect(forgotten).toEqual([manual.id])
    expect(events).toEqual([])
  })

  it('removing a workspace removes only its own projects and their history', async () => {
    await projectDir('web')
    const elsewhere = await projectDir('elsewhere', dir)
    const { projects, workspaces } = makeServices()
    const workspace = await workspaces.add(code)
    const discovered = only(await projects.list())
    const manual = await projects.add(elsewhere)

    await workspaces.remove(workspace.id)

    await expect(projects.list()).resolves.toEqual([manual])
    await expect(workspaces.list()).resolves.toEqual([])
    expect(forgotten).toEqual([discovered.id])
    await expectCode(workspaces.remove(workspace.id), 'WORKSPACE_NOT_FOUND')
  })

  it('rejects workspaces that contain or sit inside another one', async () => {
    const { workspaces } = makeServices('win32')
    await workspaces.add(code)

    await mkdir(join(code, 'inner'))
    await expectCode(workspaces.add(join(code, 'inner')), 'WORKSPACE_OVERLAP')
    await expectCode(workspaces.add(dir), 'WORKSPACE_OVERLAP')
    await expectCode(workspaces.add(code.toUpperCase()), 'WORKSPACE_OVERLAP')
  })

  it.each([
    ['a relative path', 'code', undefined, 'INVALID_INPUT'],
    ['a missing directory', '/definitely/missing/devhub', undefined, 'PROJECT_PATH_NOT_FOUND'],
    ['depth 0', null, 0, 'INVALID_INPUT'],
    ['depth 6', null, 6, 'INVALID_INPUT']
  ] as const)('rejects %s', async (_label, path, depth, code_) => {
    await expectCode(makeServices().workspaces.add(path ?? code, depth), code_)
  })

  it('rejects invalid updates without changing the workspace', async () => {
    const { workspaces } = makeServices()
    const workspace = await workspaces.add(code)

    await expectCode(workspaces.update(workspace.id, { depth: 9 }), 'INVALID_INPUT')
    await expectCode(workspaces.update(workspace.id, { excluded: ['relative'] }), 'INVALID_INPUT')
    await expectCode(workspaces.update('nope', { depth: 2 }), 'WORKSPACE_NOT_FOUND')
    await expect(workspaces.list()).resolves.toMatchObject([{ depth: 1, excluded: [] }])
  })

  it('shares one pending rescan between concurrent callers', async () => {
    await projectDir('web')
    const { workspaces } = makeServices()
    await workspaces.add(code)
    scanCount = 0

    const first = workspaces.rescanAll()
    const second = workspaces.rescanAll()
    expect(second).toBe(first)
    await first
    expect(scanCount).toBe(1)

    // Once a rescan has started, a new call scans again (files may have changed meanwhile).
    await workspaces.rescanAll()
    expect(scanCount).toBe(2)
  })
})
