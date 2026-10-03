import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMavenDetector } from './maven-detector'

const boot =
  '<build><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></build>'
const pom = (modules: string[] = [], body = '') =>
  `<project>${body}<modules>${modules.map((module) => `<module>${module}</module>`).join('')}</modules></project>`

describe('Maven multi-module detection', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-maven-modules-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  const writePom = async (parts: string[], content: string) => {
    const target = join(dir, ...parts)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'pom.xml'), content)
  }
  const detect = (platform: NodeJS.Platform = 'linux') =>
    createMavenDetector({ platform }).detect(dir)

  it.each(['win32', 'linux'] as const)(
    'uses root wrapper and separate build/start scripts on %s',
    async (platform) => {
      await writePom([], pom(['library', 'service']))
      await writePom(['library'], pom())
      await writePom(['service'], pom([], boot))
      const wrapper = platform === 'win32' ? 'mvnw.cmd' : 'mvnw'
      await writeFile(join(dir, wrapper), '')
      await chmod(join(dir, wrapper), 0o755)
      await writeFile(join(dir, 'service', wrapper), '')
      const resources = join(dir, 'service', 'src', 'main', 'resources')
      await mkdir(resources, { recursive: true })
      await writeFile(join(resources, 'application.properties'), 'server.port=8093')
      const scripts = await detect(platform)
      const executable = platform === 'win32' ? 'mvnw.cmd' : './mvnw'
      expect(scripts.slice(5)).toEqual([
        {
          id: 'maven:service:install-dependencies',
          name: 'service:install-dependencies',
          source: 'maven',
          command: `${executable} -pl service -am install -DskipTests`,
          description: '构建模块及其依赖并安装到本地仓库（跳过测试）'
        },
        {
          id: 'maven:service:spring-boot:run',
          name: 'service:spring-boot:run',
          source: 'maven',
          command: `${executable} -pl service spring-boot:run`,
          description: '运行模块 Spring Boot 应用（先构建依赖）',
          ports: [8093]
        }
      ])
      expect(scripts.every((script) => script.cwd === undefined)).toBe(true)
      expect(await detect(platform)).toEqual(scripts)
    }
  )

  it('deduplicates nested modules and stops after three module edges', async () => {
    await writePom([], pom(['a', 'a', 'a/b']))
    await writePom(['a'], pom(['b']))
    await writePom(['a', 'b'], pom(['c'], boot))
    await writePom(['a', 'b', 'c'], pom(['unread'], boot))
    const scripts = await detect()
    expect(
      scripts.filter((script) => script.id.endsWith('spring-boot:run')).map((script) => script.id)
    ).toEqual(['maven:a/b:spring-boot:run', 'maven:a/b/c:spring-boot:run'])
  })

  it('quotes safe module names containing spaces', async () => {
    await writePom([], pom(['my service']))
    await writePom(['my service'], pom([], boot))
    expect((await detect()).at(-1)?.command).toBe('mvn -pl "my service" spring-boot:run')
  })

  it('skips pom aggregators and inherits plugins only through the local Maven parent', async () => {
    await writePom(
      [],
      pom(['service', 'unrelated', 'aggregator'], `<packaging>pom</packaging>${boot}`)
    )
    await writePom(['service'], pom([], '<parent><artifactId>root</artifactId></parent>'))
    await writePom(['unrelated'], pom())
    await writePom(['aggregator'], pom([], `<packaging>pom</packaging>${boot}`))
    const scripts = await detect()
    expect(
      scripts.filter((script) => script.id.endsWith('spring-boot:run')).map((script) => script.id)
    ).toEqual(['maven:service:spring-boot:run'])
  })

  it('does not inherit a plugin with inherited=false', async () => {
    const nonInherited = boot.replace('</plugin>', '<inherited>false</inherited></plugin>')
    await writePom([], pom(['service'], `<packaging>pom</packaging>${nonInherited}`))
    await writePom(['service'], pom([], '<parent><artifactId>root</artifactId></parent>'))
    expect(await detect()).toHaveLength(5)
  })

  it('does not follow external parent POMs', async () => {
    await writePom([], pom(['service'], `<packaging>pom</packaging>${boot}`))
    await writePom(
      ['service'],
      pom([], '<parent><relativePath>../../outside/pom.xml</relativePath></parent>')
    )
    expect(await detect()).toHaveLength(5)
  })

  it('validates parent paths before using them', async () => {
    await writePom([], pom([], '<parent><relativePath>${parent}</relativePath></parent>'))
    await expect(detect()).rejects.toThrow('父模块路径无效')
  })

  it('scopes a runnable root with modules to the root only', async () => {
    await writePom([], pom(['child'], boot))
    await writePom(['child'], pom())
    expect((await detect()).find((script) => script.id === 'maven:spring-boot:run')?.command).toBe(
      'mvn -N spring-boot:run'
    )
  })

  it('does not match a different plugin group with the same artifactId', async () => {
    await writePom(
      [],
      pom([], boot.replace('<artifactId>', '<groupId>com.example</groupId><artifactId>'))
    )
    expect(await detect()).toHaveLength(5)
  })

  it.each([
    '../outside',
    '/absolute',
    'C:/outside',
    'a/../../b',
    'a\\b',
    '-flags',
    'a;echo',
    'a&echo',
    'a$(echo)',
    '${module}',
    'a%PATH%',
    'a"b',
    '',
    './a'
  ])('rejects unsafe/dynamic module %s', async (module) => {
    await writePom([], pom([module]))
    await expect(detect()).rejects.toThrow('模块路径无效')
  })

  it('rejects a missing module POM', async () => {
    await writePom([], pom(['empty']))
    await mkdir(join(dir, 'empty'))
    await expect(detect()).rejects.toThrow('模块缺少 pom.xml')
  })

  it('ignores comments, pluginManagement, dependencies and profile-only declarations', async () => {
    await writePom(
      [],
      pom(
        [],
        `<!-- ${boot} --><dependencies><dependency><artifactId>spring-boot-maven-plugin</artifactId></dependency></dependencies><build><pluginManagement><plugins><plugin><artifactId>spring-boot-maven-plugin</artifactId></plugin></plugins></pluginManagement></build><profiles><profile>${boot}<modules><module>missing</module></modules></profile></profiles>`
      )
    )
    expect(await detect()).toHaveLength(5)
  })

  it.each([
    '<project><modules></project>',
    '<project>',
    '<wrong/>',
    '<!DOCTYPE project><project/>'
  ])('reports malformed/unsupported XML', async (content) => {
    await writePom([], content)
    await expect(detect()).rejects.toThrow('pom.xml')
  })

  it('accepts namespaced POMs', async () => {
    await writePom(
      [],
      '<m:project xmlns:m="urn:maven"><m:build><m:plugins><m:plugin><m:artifactId>spring-boot-maven-plugin</m:artifactId></m:plugin></m:plugins></m:build></m:project>'
    )
    expect((await detect()).at(-1)?.id).toBe('maven:spring-boot:run')
  })

  it('terminates a symlink cycle pointing back to the root', async () => {
    await writePom([], pom(['a']))
    await writePom(['a'], pom(['loop'], boot))
    await symlink(dir, join(dir, 'a', 'loop'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(await detect()).toHaveLength(7)
  })

  it('rejects a symlink pointing outside the root before reading its POM', async () => {
    await writePom([], pom(['escape']))
    const outside = await mkdtemp(join(tmpdir(), 'devhub-maven-outside-'))
    try {
      await symlink(outside, join(dir, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
      await expect(detect()).rejects.toThrow('超出项目目录')
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})
