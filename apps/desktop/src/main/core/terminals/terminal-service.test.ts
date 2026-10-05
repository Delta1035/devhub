import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type Project } from '@devhub/shared'
import type { LaunchSpec } from '../editors/editor-launch'
import type { SystemTerminal } from './terminal-locator'
import { createSystemTerminalService } from './terminal-service'

describe('createSystemTerminalService', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-terminal-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const wt: SystemTerminal = {
    name: 'Windows Terminal',
    path: 'C:/wt.exe',
    args: (target) => ['-d', target]
  }

  const makeService = (
    terminal: SystemTerminal | null,
    launch = vi.fn<(spec: LaunchSpec, cwd: string) => Promise<void>>(async () => undefined),
    projectPath = dir
  ) => ({
    launch,
    service: createSystemTerminalService({
      projects: {
        async get(id): Promise<Project> {
          if (id !== 'p1') throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
          return { id: 'p1', name: 'app', path: projectPath, addedAt: '2026-10-05T00:00:00.000Z' }
        }
      },
      locator: { locate: async () => terminal },
      launch,
      resolveEnv: async () => ({ PATH: '/bin', ELECTRON_RUN_AS_NODE: '1' })
    })
  })

  it('reports the detected terminal', async () => {
    await expect(makeService(wt).service.get()).resolves.toEqual({
      name: 'Windows Terminal',
      path: 'C:/wt.exe'
    })
    await expect(makeService(null).service.get()).resolves.toBeNull()
  })

  it('opens a visible window in the project directory resolved by the core', async () => {
    const { service, launch } = makeService(wt)
    await service.open('p1')
    expect(launch).toHaveBeenCalledWith(
      {
        file: 'C:/wt.exe',
        args: ['-d', dir],
        windowsVerbatimArguments: false,
        windowsHide: false,
        env: { PATH: '/bin' }
      },
      dir
    )
  })

  it.each([['nope'], [42], [undefined]])('rejects project %s', async (id) => {
    const { service, launch } = makeService(wt)
    await expect(service.open(id)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('refuses a project whose directory is gone', async () => {
    const { service, launch } = makeService(wt, undefined, join(dir, 'gone'))
    await expect(service.open('p1')).rejects.toMatchObject({ code: 'PROJECT_PATH_NOT_FOUND' })
    expect(launch).not.toHaveBeenCalled()
  })

  it('reports a machine without a terminal', async () => {
    await expect(makeService(null).service.open('p1')).rejects.toMatchObject({
      code: 'TERMINAL_NOT_FOUND',
      message: '未检测到系统终端'
    })
  })

  it('wraps launch failures', async () => {
    const { service } = makeService(
      wt,
      vi.fn(async () => {
        throw new Error('spawn ENOENT')
      })
    )
    await expect(service.open('p1')).rejects.toMatchObject({
      code: 'TERMINAL_LAUNCH_FAILED',
      message: '无法启动 Windows Terminal：spawn ENOENT'
    })
  })
})
