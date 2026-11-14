import { describe, expect, it } from 'vitest'
import { projectConfigSchema, projectSchema, scriptSchema, scriptSourceSchema } from './domain'

describe('projectSchema', () => {
  const project = {
    id: 'p1',
    name: 'project',
    path: '/project',
    addedAt: '2026-01-01T00:00:00.000Z'
  }

  it('loads older projects without a pin and preserves a valid pin timestamp', () => {
    expect(projectSchema.parse(project)).toEqual(project)
    expect(projectSchema.parse({ ...project, pinnedAt: '2026-01-02T00:00:00.000Z' }).pinnedAt).toBe(
      '2026-01-02T00:00:00.000Z'
    )
  })
})

it('preserves the inferred-port warning for clients', () => {
  const script = {
    id: 'npm:dev',
    name: 'dev',
    source: 'npm',
    command: 'npm run dev',
    ports: [5173],
    portsInferred: true
  }
  expect(scriptSchema.parse(script)).toEqual(script)
})

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

  it.each(['error', 'terminate'])('preserves an explicit script conflict policy: %s', (policy) => {
    const script = { command: 'node server.js', portConflictPolicy: policy }
    expect(projectConfigSchema.parse({ scripts: { web: script } }).scripts.web).toEqual(script)
    expect(
      scriptSchema.parse({ id: 'custom:web', name: 'web', source: 'custom', ...script })
        .portConflictPolicy
    ).toBe(policy)
  })

  it('leaves an absent script conflict policy available for inheritance', () => {
    expect(
      projectConfigSchema.parse({ scripts: { web: { command: 'node server.js' } } }).scripts.web
    ).not.toHaveProperty('portConflictPolicy')
  })

  it.each([
    [{ scripts: { api: {} } }],
    [{ scripts: { api: { command: '' } } }],
    [{ scripts: { api: { command: 'x', port: 70000 } } }],
    [{ scripts: { api: { command: 'x', comand: 'typo' } } }],
    [{ scripts: { api: { command: 'x', portConflictPolicy: 'kill' } } }],
    [{ script: {} }]
  ])('rejects %j', (config) => {
    expect(projectConfigSchema.safeParse(config).success).toBe(false)
  })
})

describe('scriptSourceSchema', () => {
  it.each(['npm', 'maven', 'gradle', 'custom', 'go'])('accepts %s', (source) => {
    expect(scriptSourceSchema.parse(source)).toBe(source)
  })
})
