import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createConfigDetector } from './config-detector'

describe('createConfigDetector', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-config-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const write = (content: string, name = '.devhub.yaml') => writeFile(join(dir, name), content)
  const detect = (platform: NodeJS.Platform = 'linux') =>
    createConfigDetector({ platform }).detect(dir)

  it('returns nothing without a config file', async () => {
    await expect(detect()).resolves.toEqual([])
  })

  it('reads custom scripts with cwd, description and an explicit port', async () => {
    await write(`
scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server
    cwd: server
    description: 后端服务
    port: 8081
  compose:
    command: docker compose up
`)
    await expect(detect()).resolves.toEqual([
      {
        id: 'custom:api',
        name: 'api',
        source: 'custom',
        command: 'mvnw.cmd spring-boot:run -pl server',
        cwd: 'server',
        description: '后端服务',
        ports: [8081]
      },
      { id: 'custom:compose', name: 'compose', source: 'custom', command: 'docker compose up' }
    ])
  })

  it('infers ports from the command when none is given', async () => {
    await write('scripts:\n  web:\n    command: npx vite --port 5180\n')
    await expect(detect()).resolves.toMatchObject([{ ports: [5180] }])
  })

  it('reads an HTTP health path, which needs a known port', async () => {
    await write(
      'scripts:\n  api:\n    command: java -jar app.jar\n    port: 8081\n    health: /actuator/health\n'
    )
    await expect(detect()).resolves.toMatchObject([
      { ports: [8081], healthPath: '/actuator/health' }
    ])
    await write('scripts:\n  api:\n    command: java -jar app.jar\n    health: /status\n')
    await expect(detect()).rejects.toThrow('脚本 api 设置了 health，但不知道端口：请同时填写 port')
    await write('scripts:\n  api:\n    command: x\n    port: 1\n    health: status\n')
    await expect(detect()).rejects.toThrow('scripts.api.health 必须以 / 开头且不含空白')
  })

  it('also reads .devhub.yml', async () => {
    await write('scripts:\n  a:\n    command: echo a\n', '.devhub.yml')
    await expect(detect()).resolves.toMatchObject([{ id: 'custom:a' }])
  })

  it('picks the command for the current platform and skips scripts without one', async () => {
    await write(`
scripts:
  api:
    command:
      windows: mvnw.cmd spring-boot:run
      linux: ./mvnw spring-boot:run
  winOnly:
    command:
      windows: start.bat
`)
    await expect(detect('win32')).resolves.toMatchObject([
      { name: 'api', command: 'mvnw.cmd spring-boot:run' },
      { name: 'winOnly', command: 'start.bat' }
    ])
    await expect(detect('linux')).resolves.toMatchObject([
      { name: 'api', command: './mvnw spring-boot:run' }
    ])
  })

  it('treats an empty file as no scripts', async () => {
    await write('# nothing yet\n')
    await expect(detect()).resolves.toEqual([])
  })

  it('reports invalid YAML with its line number', async () => {
    await write('scripts:\n  api:\n    command: "unclosed\n')
    await expect(detect()).rejects.toThrow(/^\.devhub\.yaml 第 \d+ 行不是有效的 YAML/)
  })

  it.each([
    ['scripts:\n  api:\n    cwd: server\n', '.devhub.yaml 格式不正确：scripts.api.command'],
    [
      'scripts:\n  api:\n    command: x\n    comand: typo\n',
      '.devhub.yaml 格式不正确：scripts.api'
    ],
    [
      'scripts:\n  api:\n    command: x\n    port: 99999\n',
      '.devhub.yaml 格式不正确：scripts.api.port'
    ]
  ])('reports where the content is wrong (%#)', async (content, message) => {
    await write(content)
    await expect(detect()).rejects.toThrow(message)
  })

  it.each([['../elsewhere'], ['/etc']])('refuses a cwd outside the project: %s', async (cwd) => {
    await write(`scripts:\n  api:\n    command: x\n    cwd: ${cwd}\n`)
    await expect(detect()).rejects.toThrow('cwd 必须在项目目录内')
  })
})
