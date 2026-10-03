import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { npmDetector } from './npm-detector'

describe('npmDetector', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-npm-'))
    await mkdir(join(dir, '.git'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const writePackageJson = (content: unknown) =>
    writeFile(
      join(dir, 'package.json'),
      typeof content === 'string' ? content : JSON.stringify(content)
    )
  const touch = (file: string) => writeFile(join(dir, file), '')
  const commands = async () => (await npmDetector.detect(dir)).map((script) => script.command)

  it('returns nothing without a package.json', async () => {
    await expect(npmDetector.detect(dir)).resolves.toEqual([])
  })

  it('returns nothing when package.json has no scripts', async () => {
    await writePackageJson({ name: 'app' })
    await expect(npmDetector.detect(dir)).resolves.toEqual([])
  })

  it('lists scripts in declaration order with stable ids and raw bodies', async () => {
    await writePackageJson({ scripts: { dev: 'vite --port 5173', build: 'vite build' } })
    await expect(npmDetector.detect(dir)).resolves.toEqual([
      {
        id: 'npm:dev',
        name: 'dev',
        source: 'npm',
        command: 'npm run dev',
        description: 'vite --port 5173',
        ports: [5173]
      },
      {
        id: 'npm:build',
        name: 'build',
        source: 'npm',
        command: 'npm run build',
        description: 'vite build'
      }
    ])
  })

  it('skips non-string entries and omits empty descriptions', async () => {
    await writePackageJson({ scripts: { ok: '', broken: 42, nested: { a: 1 } } })
    await expect(npmDetector.detect(dir)).resolves.toEqual([
      { id: 'npm:ok', name: 'ok', source: 'npm', command: 'npm run ok' }
    ])
  })

  it('quotes script names that are not shell-safe', async () => {
    await writePackageJson({ scripts: { 'build:prod': 'x', 'start dev': 'y' } })
    await expect(commands()).resolves.toEqual(['npm run build:prod', 'npm run "start dev"'])
  })

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm']
  ])('detects the package manager from %s', async (lockfile, manager) => {
    await writePackageJson({ scripts: { dev: 'vite' } })
    await touch(lockfile)
    await expect(commands()).resolves.toEqual([`${manager} run dev`])
  })

  it('prefers pnpm when several lockfiles exist', async () => {
    await writePackageJson({ scripts: { dev: 'vite' } })
    await touch('package-lock.json')
    await touch('pnpm-lock.yaml')
    await expect(commands()).resolves.toEqual(['pnpm run dev'])
  })

  it('prefers the packageManager field over lockfiles', async () => {
    await writePackageJson({ packageManager: 'yarn@4.5.0', scripts: { dev: 'vite' } })
    await touch('pnpm-lock.yaml')
    await expect(commands()).resolves.toEqual(['yarn run dev'])
  })

  it('ignores an unknown packageManager and falls back to lockfiles', async () => {
    await writePackageJson({ packageManager: 'bun@1.1.0', scripts: { dev: 'vite' } })
    await touch('yarn.lock')
    await expect(commands()).resolves.toEqual(['yarn run dev'])
  })

  it.each([
    ['malformed JSON', '{ "scripts": ', 'package.json 不是有效的 JSON'],
    ['a non-object root', '[1, 2]', 'package.json 格式不正确'],
    ['scripts that is not an object', '{ "scripts": "dev" }', 'package.json 格式不正确']
  ])('throws a readable error for %s', async (_label, content, message) => {
    await writePackageJson(content)
    await expect(npmDetector.detect(dir)).rejects.toThrow(message)
  })

  it('throws when package.json cannot be read', async () => {
    await mkdir(join(dir, 'package.json'))
    await expect(npmDetector.detect(dir)).rejects.toThrow('无法读取 package.json')
  })
})
