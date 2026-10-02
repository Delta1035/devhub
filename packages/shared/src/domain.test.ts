import { describe, expect, it } from 'vitest'
import { projectConfigSchema } from './domain'

describe('projectConfigSchema', () => {
  it('fills defaults for an empty config', () => {
    expect(projectConfigSchema.parse({})).toEqual({ scripts: {} })
  })

  it('parses custom scripts', () => {
    const config = projectConfigSchema.parse({
      scripts: { api: { command: 'mvn spring-boot:run', cwd: 'server' } }
    })
    expect(config.scripts.api?.cwd).toBe('server')
  })

  it('rejects a script without a command', () => {
    expect(projectConfigSchema.safeParse({ scripts: { api: {} } }).success).toBe(false)
  })
})
