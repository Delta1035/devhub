import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { scanWorkspace, type ReadDir } from './workspace-scanner'

describe('scanWorkspace', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'devhub-workspace-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  /** Creates `relative` under the root (with parents) and writes a file into it. */
  const file = async (relative: string, name: string): Promise<void> => {
    await mkdir(join(root, relative), { recursive: true })
    await writeFile(join(root, relative, name), '{}')
  }
  const dir = (relative: string) => mkdir(join(root, relative), { recursive: true })
  const at = (...parts: string[]) => join(root, ...parts)

  it('finds direct children with any project marker at depth 1', async () => {
    await file('web', 'package.json')
    await file('api', 'pom.xml')
    await file('gradle-kts', 'build.gradle.kts')
    await file('multi', 'settings.gradle')
    await file('custom', '.devhub.yaml')
    await file('notes', 'README.md')
    await file('group/nested', 'package.json')

    const result = await scanWorkspace(root, { depth: 1 })

    expect(result).toEqual({
      status: 'ok',
      projects: [at('api'), at('custom'), at('gradle-kts'), at('multi'), at('web')],
      complete: true,
      warnings: []
    })
  })

  it('searches deeper levels up to the configured depth', async () => {
    await file('group/a', 'package.json')
    await file('group/deeper/b', 'package.json')

    const depth2 = await scanWorkspace(root, { depth: 2 })
    expect(depth2).toMatchObject({ projects: [at('group', 'a')], complete: true })

    const depth3 = await scanWorkspace(root, { depth: 3 })
    expect(depth3).toMatchObject({ projects: [at('group', 'a'), at('group', 'deeper', 'b')] })
  })

  it('does not search inside a project or treat the root as one', async () => {
    await writeFile(join(root, 'package.json'), '{}')
    await file('app', 'pom.xml')
    await file('app/module', 'pom.xml')

    const result = await scanWorkspace(root, { depth: 5 })

    expect(result).toMatchObject({ projects: [at('app')] })
  })

  it('skips hidden, dependency and build output directories', async () => {
    for (const name of ['.git', '.idea', 'node_modules', 'Target', 'build', 'dist', 'out']) {
      await file(join(name, 'inner'), 'package.json')
    }
    await file('real/inner', 'package.json')

    const result = await scanWorkspace(root, { depth: 2 })

    expect(result).toMatchObject({ projects: [at('real', 'inner')] })
  })

  it('ignores a marker that is a directory', async () => {
    await dir('odd/package.json')

    await expect(scanWorkspace(root, { depth: 1 })).resolves.toMatchObject({ projects: [] })
  })

  it('does not follow directory symlinks or junctions, so cycles end', async () => {
    await file('real', 'package.json')
    await dir('loop')
    // Junctions need no privileges on Windows; elsewhere the type is ignored.
    await symlink(root, at('loop', 'back'), 'junction')
    await symlink(at('real'), at('alias'), 'junction')

    const result = await scanWorkspace(root, { depth: 5 })

    expect(result).toEqual({ status: 'ok', projects: [at('real')], complete: true, warnings: [] })
  })

  it('reports an unavailable root instead of an empty result', async () => {
    const missing = await scanWorkspace(at('missing'), { depth: 1 })
    expect(missing).toEqual({ status: 'unavailable', reason: '目录不存在' })

    await writeFile(at('file.txt'), '')
    const notDir = await scanWorkspace(at('file.txt'), { depth: 1 })
    expect(notDir.status).toBe('unavailable')
  })

  it('keeps scanning past unreadable directories and marks the result incomplete', async () => {
    await file('a', 'package.json')
    await dir('locked')
    await file('z', 'package.json')
    const readDir: ReadDir = async (path) => {
      if (path === at('locked')) {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      }
      return readdir(path, { withFileTypes: true })
    }

    const result = await scanWorkspace(root, { depth: 2, readDir })

    expect(result).toEqual({
      status: 'ok',
      projects: [at('a'), at('z')],
      complete: false,
      warnings: [`无法读取 ${at('locked')}：没有访问权限`]
    })
  })

  it('stops at the directory limit and says the result is incomplete', async () => {
    for (const name of ['a', 'b', 'c', 'd']) await file(name, 'package.json')

    // The root counts as one directory read, so a limit of 3 reads two children.
    const result = await scanWorkspace(root, { depth: 1, maxDirectories: 3 })

    expect(result).toMatchObject({
      status: 'ok',
      projects: [at('a'), at('b')],
      complete: false
    })
    expect(result.status === 'ok' && result.warnings[0]).toContain('只扫描了前 3 个目录')
  })
})
