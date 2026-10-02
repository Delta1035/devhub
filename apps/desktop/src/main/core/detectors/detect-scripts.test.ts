import { describe, expect, it } from 'vitest'
import type { Script, ScriptSource } from '@devhub/shared'
import { detectScripts } from './detect-scripts'
import type { ScriptDetector } from './types'

const script = (source: ScriptSource, name: string): Script => ({
  id: `${source}:${name}`,
  name,
  source,
  command: `${source} ${name}`
})

const detector = (source: ScriptSource, detect: ScriptDetector['detect']): ScriptDetector => ({
  source,
  detect
})

describe('detectScripts', () => {
  it('merges scripts from all detectors in detector order', async () => {
    const result = await detectScripts('/repo', [
      detector('npm', async () => [script('npm', 'dev')]),
      detector('maven', async () => [script('maven', 'package')])
    ])
    expect(result).toEqual({
      scripts: [script('npm', 'dev'), script('maven', 'package')],
      warnings: []
    })
  })

  it('passes the directory to every detector', async () => {
    const seen: string[] = []
    await detectScripts('/repo', [
      detector('npm', async (dir) => {
        seen.push(dir)
        return []
      })
    ])
    expect(seen).toEqual(['/repo'])
  })

  it('turns a failing detector into a warning and keeps the others', async () => {
    const result = await detectScripts('/repo', [
      detector('npm', async () => {
        throw new Error('package.json 不是有效的 JSON')
      }),
      detector('gradle', async () => [script('gradle', 'build')])
    ])
    expect(result).toEqual({
      scripts: [script('gradle', 'build')],
      warnings: [{ source: 'npm', message: 'package.json 不是有效的 JSON' }]
    })
  })

  it('stringifies non-Error rejections', async () => {
    const result = await detectScripts('/repo', [detector('npm', () => Promise.reject('boom'))])
    expect(result.warnings).toEqual([{ source: 'npm', message: 'boom' }])
  })
})
