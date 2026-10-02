import { describe, expect, it } from 'vitest'
import { projectConfigSchema } from './domain'

describe('projectConfigSchema', () => {
  it('fills defaults for an empty config', () => {
    expect(projectConfigSchema.parse({})).toEqual({ scripts: {} })
  })

  it('parses custom scripts with a cwd, description and port', () => {
    const config = projectConfigSchema.parse({
      scripts: {
        api: { command: 'mvn spring-boot:run', cwd: 'server', description: '后端', port: 8081 }
      }
    })
    expect(config.scripts.api).toEqual({
      command: 'mvn spring-boot:run',
      cwd: 'server',
      description: '后端',
      port: 8081
    })
  })

  it('accepts per-platform commands, needing at least one', () => {
    const command = { windows: 'mvnw.cmd spring-boot:run', linux: './mvnw spring-boot:run' }
    expect(
      projectConfigSchema.parse({ scripts: { api: { command } } }).scripts.api?.command
    ).toEqual(command)
    expect(projectConfigSchema.safeParse({ scripts: { api: { command: {} } } }).success).toBe(false)
  })

  it.each([
    [{ scripts: { api: {} } }],
    [{ scripts: { api: { command: '' } } }],
    [{ scripts: { api: { command: 'x', port: 70000 } } }],
    [{ scripts: { api: { command: 'x', comand: 'typo' } } }],
    [{ script: {} }]
  ])('rejects %j', (config) => {
    expect(projectConfigSchema.safeParse(config).success).toBe(false)
  })
})
