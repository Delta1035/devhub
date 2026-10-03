import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { npmDetector } from './npm-detector'

describe('npm workspace package manager resolution', () => {
  let root: string
  let child: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'devhub-workspace-'))
    await mkdir(join(root, '.git'))
    child = join(root, 'packages', 'app')
    await mkdir(child, { recursive: true })
    await writePackage(child, { scripts: { dev: 'node app.js' } })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const writePackage = (dir: string, json: unknown) =>
    writeFile(join(dir, 'package.json'), JSON.stringify(json))
  const command = async (dir = child) => (await npmDetector.detect(dir))[0]?.command

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
    ['pnpm-workspace.yaml', 'pnpm']
  ])('inherits %s from the repository root', async (file, manager) => {
    await writeFile(join(root, file), '')
    expect(await command()).toBe(`${manager} run dev`)
    expect(await npmDetector.detect(child)).toEqual([
      {
        id: 'npm:dev',
        name: 'dev',
        source: 'npm',
        command: `${manager} run dev`,
        description: 'node app.js'
      }
    ])
  })

  it('prefers the root declaration to its lockfiles', async () => {
    await writePackage(root, { packageManager: 'yarn@4.5.0' })
    await writeFile(join(root, 'pnpm-lock.yaml'), '')
    expect(await command()).toBe('yarn run dev')
  })

  it('prefers child configuration to ancestor configuration', async () => {
    await writePackage(root, { packageManager: 'pnpm@11.9.0' })
    await writeFile(join(child, 'yarn.lock'), '')
    expect(await command()).toBe('yarn run dev')
    await writePackage(child, { packageManager: 'npm@11', scripts: { dev: 'node app.js' } })
    expect(await command()).toBe('npm run dev')
  })

  it('uses the nearest ancestor with a package manager signal', async () => {
    await writeFile(join(root, 'pnpm-lock.yaml'), '')
    await writeFile(join(root, 'packages', 'yarn.lock'), '')
    expect(await command()).toBe('yarn run dev')
  })

  it.each(['directory', 'file'])('stops at a nested .git %s', async (kind) => {
    await writeFile(join(root, 'pnpm-lock.yaml'), '')
    const marker = join(root, 'packages', '.git')
    if (kind === 'directory') await mkdir(marker)
    else await writeFile(marker, 'gitdir: elsewhere')
    expect(await command()).toBe('npm run dev')
    await writeFile(join(root, 'packages', 'yarn.lock'), '')
    expect(await command()).toBe('yarn run dev')
  })

  it('does not search ancestors of a child that is itself a repository', async () => {
    await writeFile(join(root, 'pnpm-lock.yaml'), '')
    await mkdir(join(child, '.git'))
    expect(await command()).toBe('npm run dev')
  })

  it('searches five ancestors but not six', async () => {
    await writeFile(join(root, 'pnpm-lock.yaml'), '')
    const fifth = join(root, 'a', 'b', 'c', 'd', 'e')
    const sixth = join(fifth, 'f')
    await mkdir(sixth, { recursive: true })
    await writePackage(fifth, { scripts: { dev: 'node app.js' } })
    await writePackage(sixth, { scripts: { dev: 'node app.js' } })
    expect(await command(fifth)).toBe('pnpm run dev')
    expect(await command(sixth)).toBe('npm run dev')
  })

  it('ignores unsupported ancestor declarations and uses their lockfiles', async () => {
    await writePackage(root, { packageManager: 'bun@1' })
    await writeFile(join(root, 'yarn.lock'), '')
    expect(await command()).toBe('yarn run dev')
  })

  it.each([
    ['{', '上级目录的 package.json 不是有效的 JSON'],
    ['[]', '上级目录的 package.json 格式不正确']
  ])('reports invalid ancestor configuration: %s', async (raw, message) => {
    await writeFile(join(root, 'package.json'), raw)
    await expect(command()).rejects.toThrow(message)
  })
})
