import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inferNpmPorts, readSpringPort } from './infer-ports'

describe('inferNpmPorts', () => {
  it.each([
    ['vite', [5173]],
    ['vite dev', [5173]],
    ['vite --host', [5173]],
    ['vite preview', [4173]],
    ['vite build', []],
    ['vite --port 5174', [5174]],
    ['vite --port=5175', [5175]],
    ['next dev -p 4000', [4000]],
    ['next dev', [3000]],
    ['next build', []],
    ['cross-env NODE_ENV=dev react-scripts start', [3000]],
    ['PORT=3001 node server.js', [3001]],
    ['vue-cli-service serve', [8080]],
    ['ng serve', [4200]],
    ['astro dev', [4321]],
    ['node_modules/.bin/vite', [5173]],
    ['tsc -b && vite build && vite preview', [4173]],
    ['eslint .', []],
    ['vitest', []],
    ['node server.js --port 99999', []]
  ])('%s → %o', (body, ports) => {
    expect(inferNpmPorts(body)).toEqual(ports)
  })
})

describe('readSpringPort', () => {
  let dir: string
  const resources = () => join(dir, 'src', 'main', 'resources')

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-spring-'))
    await mkdir(resources(), { recursive: true })
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('defaults to 8080', async () => {
    await expect(readSpringPort(dir)).resolves.toBe(8080)
  })

  it.each([
    ['server.port=8081'],
    ['server.port = 8081'],
    ['server.port=${PORT:8081}'],
    ['spring.application.name=api\nserver.port: 8081']
  ])('reads application.properties: %s', async (content) => {
    await writeFile(join(resources(), 'application.properties'), content)
    await expect(readSpringPort(dir)).resolves.toBe(8081)
  })

  it.each([
    ['server:\n  port: 9090'],
    [
      'spring:\n  application:\n    name: api\nserver:\n  servlet:\n    context-path: /api\n  port: 9090'
    ],
    ['server:\n  port: ${SERVER_PORT:9090}'],
    ['server:\n  port: "9090"']
  ])('reads application.yml: %#', async (content) => {
    await writeFile(join(resources(), 'application.yml'), content)
    await expect(readSpringPort(dir)).resolves.toBe(9090)
  })

  it('ignores a port key of another section in yml', async () => {
    await writeFile(join(resources(), 'application.yml'), 'management:\n  port: 9001\n')
    await expect(readSpringPort(dir)).resolves.toBe(8080)
  })
})
