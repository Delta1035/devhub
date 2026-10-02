import { chmod, mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGradleDetector } from './gradle-detector'

describe('createGradleDetector', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-gradle-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const write = (file: string, content = '') => writeFile(join(dir, file), content)
  const detect = (platform: NodeJS.Platform = 'linux') =>
    createGradleDetector({ platform }).detect(dir)
  const names = async () => (await detect()).map((script) => script.name)

  it('returns nothing without Gradle files', async () => {
    await expect(detect()).resolves.toEqual([])
  })

  it.each(['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'])(
    'recognizes a project with only %s',
    async (file) => {
      await write(file)
      await expect(names()).resolves.toEqual(['clean', 'build', 'test'])
    }
  )

  it('lists the common tasks with stable ids', async () => {
    await write('build.gradle')
    const scripts = await detect()
    expect(scripts[1]).toEqual({
      id: 'gradle:build',
      name: 'build',
      source: 'gradle',
      command: 'gradle build',
      description: '构建（含测试）'
    })
  })

  it.each([
    ['Groovy', 'build.gradle', "plugins {\n  id 'org.springframework.boot' version '3.3.0'\n}"],
    [
      'Kotlin',
      'build.gradle.kts',
      'plugins {\n  id("org.springframework.boot") version "3.3.0"\n}'
    ],
    ['legacy apply', 'build.gradle', "apply plugin: 'org.springframework.boot'"]
  ])('adds bootRun for the Spring Boot plugin (%s)', async (_label, file, content) => {
    await write(file, content)
    await expect(names()).resolves.toEqual(['clean', 'build', 'test', 'bootRun'])
  })

  it('does not treat a Spring Boot dependency as the plugin', async () => {
    await write(
      'build.gradle',
      "dependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web'\n}"
    )
    await expect(names()).resolves.toEqual(['clean', 'build', 'test'])
  })

  it.each([
    ['Groovy id', "plugins {\n  id 'application'\n}"],
    ['Kotlin id', 'plugins {\n  id("application")\n}'],
    ['Kotlin shorthand', 'plugins {\n  application\n}'],
    ['legacy apply', "apply plugin: 'application'"],
    ['configuration block', 'application {\n  mainClass = "app.Main"\n}']
  ])('adds run for the application plugin (%s)', async (_label, content) => {
    await write('build.gradle.kts', content)
    await expect(names()).resolves.toEqual(['clean', 'build', 'test', 'run'])
  })

  it.each([
    ['Android', "plugins {\n  id 'com.android.application'\n}"],
    ['package name', "group = 'com.example.application'"],
    ['similar property', "applicationDefaultJvmArgs = ['-Xmx1g']"]
  ])('does not add run for %s', async (_label, content) => {
    await write('build.gradle', content)
    await expect(names()).resolves.toEqual(['clean', 'build', 'test'])
  })

  it('combines plugins declared across build and settings files', async () => {
    await write('settings.gradle.kts', 'rootProject.name = "app"')
    await write('build.gradle.kts', 'plugins {\n  id("org.springframework.boot")\n  application\n}')
    await expect(names()).resolves.toEqual(['clean', 'build', 'test', 'bootRun', 'run'])
  })

  it.each<[label: string, platform: NodeJS.Platform, wrappers: string[], command: string]>([
    ['win32 with gradlew.bat', 'win32', ['gradlew', 'gradlew.bat'], 'gradlew.bat build'],
    ['win32 with only gradlew', 'win32', ['gradlew'], 'gradle build'],
    ['linux with gradlew', 'linux', ['gradlew', 'gradlew.bat'], './gradlew build'],
    ['linux with only gradlew.bat', 'linux', ['gradlew.bat'], 'gradle build']
  ])('picks the executable on %s', async (_label, platform, wrappers, command) => {
    await write('build.gradle')
    for (const wrapper of wrappers) {
      await write(wrapper)
      await chmod(join(dir, wrapper), 0o755)
    }
    const commands = (await detect(platform)).map((script) => script.command)
    expect(commands).toContain(command)
  })

  it('throws when a build file cannot be read', async () => {
    await mkdir(join(dir, 'build.gradle'))
    await expect(detect()).rejects.toThrow('无法读取 build.gradle')
  })
})
