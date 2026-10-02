import { describe, expect, it } from 'vitest'
import { projectConfigSchema } from './domain'

describe('projectConfigSchema', () => {
  it('fills defaults for an empty config', () => {
    expect(projectConfigSchema.parse({})).toEqual({ scripts: {}, profiles: [] })
  })

  it('parses custom scripts and profiles', () => {
    const config = projectConfigSchema.parse({
      scripts: { api: { command: 'mvn spring-boot:run', cwd: 'server' } },
      profiles: [{ name: 'staging', env: { API_URL: 'https://staging.example.com' } }]
    })
    expect(config.scripts.api?.cwd).toBe('server')
    expect(config.profiles[0]).toEqual({
      name: 'staging',
      env: { API_URL: 'https://staging.example.com' },
      args: []
    })
  })

  it('rejects a script without a command', () => {
    expect(projectConfigSchema.safeParse({ scripts: { api: {} } }).success).toBe(false)
  })
})
