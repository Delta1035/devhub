import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type EditorId, type Project } from '@devhub/shared'
import type { LaunchSpec } from './editor-launch'
import type { EditorLauncher } from './editor-locator'
import { createEditorService } from './editor-service'

describe('createEditorService', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-editor-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const makeService = (
    installed: Partial<Record<EditorId, EditorLauncher>>,
    launch = vi.fn<(spec: LaunchSpec, cwd: string) => Promise<void>>(async () => undefined),
    projectPath = dir,
    custom: Partial<Record<EditorId, string>> = {},
    existingFiles: string[] = []
  ) => ({
    launch,
    service: createEditorService({
      projects: {
        async get(id): Promise<Project> {
          if (id !== 'p1') throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
          return { id: 'p1', name: 'app', path: projectPath, addedAt: '2026-10-02T00:00:00.000Z' }
        }
      },
      locator: { locate: async (editor) => installed[editor] ?? null },
      launch,
      resolveEnv: async () => ({ PATH: '/bin' }),
      platform: 'win32',
      customPath: async (editor) => custom[editor] ?? null,
      isFile: async (path) => existingFiles.includes(path)
    })
  })

  it('reports which editors are installed', async () => {
    const { service } = makeService({ vscode: { kind: 'executable', path: '/usr/bin/code' } })
    await expect(service.list()).resolves.toEqual([
      { id: 'vscode', name: 'VS Code', available: true, path: '/usr/bin/code', custom: false },
      { id: 'idea', name: 'IntelliJ IDEA', available: false, path: null, custom: false }
    ])
  })

  it('launches the editor on the project directory resolved by the core', async () => {
    const { service, launch } = makeService({ idea: { kind: 'executable', path: '/opt/idea' } })
    await service.open('p1', 'idea')
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ file: '/opt/idea', args: [dir] }),
      dir
    )
  })

  it.each([['notepad'], [42], [undefined]])('rejects unknown editor %s', async (editor) => {
    const { service, launch } = makeService({})
    await expect(service.open('p1', editor)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('propagates unknown projects', async () => {
    const { service } = makeService({ vscode: { kind: 'executable', path: '/usr/bin/code' } })
    await expect(service.open('nope', 'vscode')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND'
    })
  })

  it('refuses to open a project whose directory is gone', async () => {
    const { service, launch } = makeService(
      { vscode: { kind: 'executable', path: '/usr/bin/code' } },
      undefined,
      join(dir, 'gone')
    )
    await expect(service.open('p1', 'vscode')).rejects.toMatchObject({
      code: 'PROJECT_PATH_NOT_FOUND'
    })
    expect(launch).not.toHaveBeenCalled()
  })

  it('reports a missing editor', async () => {
    const { service } = makeService({})
    await expect(service.open('p1', 'idea')).rejects.toMatchObject({
      code: 'EDITOR_NOT_FOUND',
      message: '未检测到 IntelliJ IDEA'
    })
  })

  it('wraps launch failures', async () => {
    const { service } = makeService(
      { vscode: { kind: 'executable', path: '/usr/bin/code' } },
      vi.fn(async () => {
        throw new Error('spawn EACCES')
      })
    )
    await expect(service.open('p1', 'vscode')).rejects.toMatchObject({
      code: 'EDITOR_LAUNCH_FAILED',
      message: '无法启动 VS Code：spawn EACCES'
    })
  })

  it('prefers a configured editor path over auto-detection', async () => {
    const chosen = 'D:/tools/IDEA/bin/idea64.exe'
    const { service, launch } = makeService(
      { idea: { kind: 'executable', path: '/auto/idea' } },
      undefined,
      dir,
      { idea: chosen },
      [chosen]
    )
    await expect(service.list()).resolves.toContainEqual({
      id: 'idea',
      name: 'IntelliJ IDEA',
      available: true,
      path: chosen,
      custom: true
    })
    await service.open('p1', 'idea')
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ file: chosen }), dir)
  })

  it('runs a configured .cmd launcher through cmd', async () => {
    const script = 'C:/Toolbox/scripts/idea.cmd'
    const { service, launch } = makeService({}, undefined, dir, { idea: script }, [script])
    await service.open('p1', 'idea')
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({ windowsVerbatimArguments: true }),
      dir
    )
  })

  it('falls back to auto-detection when the configured file is gone', async () => {
    const { service } = makeService(
      { vscode: { kind: 'executable', path: '/usr/bin/code' } },
      undefined,
      dir,
      { vscode: 'D:/moved/Code.exe' }
    )
    await expect(service.list()).resolves.toContainEqual(
      expect.objectContaining({ id: 'vscode', path: '/usr/bin/code', custom: false })
    )
  })
})
