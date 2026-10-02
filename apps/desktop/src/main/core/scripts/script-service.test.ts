import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DevhubError, type Project } from '@devhub/shared'
import { createDefaultDetectors } from '../detectors/detect-scripts'
import type { ScriptDetector } from '../detectors/types'
import { createScriptService } from './script-service'

describe('createScriptService', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-scripts-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const projectAt = (path: string): Project => ({
    id: 'p1',
    name: 'repo',
    path,
    addedAt: '2026-10-02T00:00:00.000Z'
  })

  const makeService = (
    path: string,
    detectors: ScriptDetector[] = createDefaultDetectors('linux')
  ) =>
    createScriptService({
      projects: {
        async get(id) {
          if (id !== 'p1') throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
          return projectAt(path)
        }
      },
      detectors
    })

  it('detects scripts in the project directory with the default detectors', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
    await expect(makeService(dir).list('p1')).resolves.toEqual({
      status: 'ok',
      scripts: [
        {
          id: 'npm:dev',
          name: 'dev',
          source: 'npm',
          command: 'npm run dev',
          description: 'vite',
          ports: [5173]
        }
      ],
      warnings: []
    })
  })

  it('combines .devhub.yaml, npm, maven and gradle scripts in one project', async () => {
    await writeFile(join(dir, '.devhub.yaml'), 'scripts:\n  mock:\n    command: node mock.js\n')
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
    await writeFile(join(dir, 'pom.xml'), '<project />')
    await writeFile(join(dir, 'build.gradle'), '')
    const { scripts } = await makeService(dir).list('p1')
    expect(scripts.map((script) => script.id)).toEqual([
      'custom:mock',
      'npm:dev',
      'maven:clean',
      'maven:compile',
      'maven:test',
      'maven:package',
      'maven:install',
      'gradle:clean',
      'gradle:build',
      'gradle:test'
    ])
  })

  it('reports detector failures as warnings', async () => {
    await writeFile(join(dir, 'package.json'), '{')
    const result = await makeService(dir).list('p1')
    expect(result.status).toBe('ok')
    expect(result.warnings).toEqual([{ source: 'npm', message: 'package.json 不是有效的 JSON' }])
  })

  it.each([
    ['was deleted', () => join(dir, 'gone')],
    ['is now a file', () => join(dir, 'file.txt')]
  ])('marks the project missing when its directory %s', async (_label, pathOf) => {
    await writeFile(join(dir, 'file.txt'), '')
    let called = false
    const service = makeService(pathOf(), [
      {
        source: 'npm',
        async detect() {
          called = true
          return []
        }
      }
    ])
    await expect(service.list('p1')).resolves.toEqual({
      status: 'missing',
      scripts: [],
      warnings: []
    })
    expect(called).toBe(false)
  })

  it('finds a script by id from a fresh scan', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
    const { project, script } = await makeService(dir).find('p1', 'npm:dev')
    expect(project.id).toBe('p1')
    expect(script.command).toBe('npm run dev')
  })

  it.each([['npm:missing'], [42]])('rejects unknown script id %s', async (scriptId) => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }))
    await expect(makeService(dir).find('p1', scriptId)).rejects.toMatchObject({
      code: 'SCRIPT_NOT_FOUND'
    })
  })

  it('refuses to find scripts when the project directory is missing', async () => {
    await expect(makeService(join(dir, 'gone')).find('p1', 'npm:dev')).rejects.toMatchObject({
      code: 'PROJECT_PATH_NOT_FOUND'
    })
  })

  it('propagates PROJECT_NOT_FOUND for unknown projects', async () => {
    await expect(makeService(dir).list('nope')).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND'
    })
  })
})
