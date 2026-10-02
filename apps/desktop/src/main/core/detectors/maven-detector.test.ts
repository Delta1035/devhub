import { chmod, mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMavenDetector } from './maven-detector'

const plainPom = '<project><artifactId>app</artifactId></project>'
const springBootPom = `<project>
  <build><plugins><plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
  </plugin></plugins></build>
</project>`

describe('createMavenDetector', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-maven-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const writePom = (content: string) => writeFile(join(dir, 'pom.xml'), content)
  const touch = (file: string) => writeFile(join(dir, file), '')
  const detect = (platform: NodeJS.Platform = 'linux') =>
    createMavenDetector({ platform }).detect(dir)
  const commands = async (platform?: NodeJS.Platform) =>
    (await detect(platform)).map((script) => script.command)

  it('returns nothing without a pom.xml', async () => {
    await expect(detect()).resolves.toEqual([])
  })

  it('lists the common lifecycle goals with stable ids', async () => {
    await writePom(plainPom)
    const scripts = await detect()
    expect(scripts.map((script) => script.id)).toEqual([
      'maven:clean',
      'maven:compile',
      'maven:test',
      'maven:package',
      'maven:install'
    ])
    expect(scripts[3]).toEqual({
      id: 'maven:package',
      name: 'package',
      source: 'maven',
      command: 'mvn package',
      description: '打包（含测试）'
    })
  })

  it('adds spring-boot:run when the Spring Boot plugin is declared', async () => {
    await writePom(springBootPom)
    const scripts = await detect()
    expect(scripts.at(-1)).toEqual({
      id: 'maven:spring-boot:run',
      name: 'spring-boot:run',
      source: 'maven',
      command: 'mvn spring-boot:run',
      description: '运行 Spring Boot 应用',
      ports: [8080]
    })
  })

  it.each<[label: string, platform: NodeJS.Platform, wrappers: string[], command: string]>([
    ['win32 with mvnw.cmd', 'win32', ['mvnw', 'mvnw.cmd'], 'mvnw.cmd package'],
    ['win32 with only mvnw', 'win32', ['mvnw'], 'mvn package'],
    ['linux with mvnw', 'linux', ['mvnw', 'mvnw.cmd'], './mvnw package'],
    ['linux with only mvnw.cmd', 'linux', ['mvnw.cmd'], 'mvn package'],
    ['no wrapper', 'win32', [], 'mvn package']
  ])('picks the executable on %s', async (_label, platform, wrappers, command) => {
    await writePom(plainPom)
    // Wrappers are executable in a normal checkout; a non-executable one is covered in fs-utils.
    for (const wrapper of wrappers) {
      await touch(wrapper)
      await chmod(join(dir, wrapper), 0o755)
    }
    expect(await commands(platform)).toContain(command)
  })

  it('throws when pom.xml cannot be read', async () => {
    await mkdir(join(dir, 'pom.xml'))
    await expect(detect()).rejects.toThrow('无法读取 pom.xml')
  })
})
