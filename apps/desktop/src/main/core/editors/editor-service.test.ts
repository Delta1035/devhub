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
    projectPath = dir
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
      env: { PATH: '/bin' }
    })
  })

  it('reports which editors are installed', async () => {
    const { service } = makeService({ vscode: { kind: 'executable', path: '/usr/bin/code' } })
    await expect(service.list()).resolves.toEqual([
      { id: 'vscode', name: 'VS Code', available: true },
      { id: 'idea', name: 'IntelliJ IDEA', available: false }
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
})
