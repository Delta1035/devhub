import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGradleDetector } from './gradle-detector'

describe('Gradle multi-project detection', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-gradle-multi-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })
  const write = async (segments: string[], content: string) => {
    await mkdir(join(dir, ...segments.slice(0, -1)), { recursive: true })
    await writeFile(join(dir, ...segments), content)
  }
  const detect = (platform: NodeJS.Platform = 'linux') =>
    createGradleDetector({ platform }).detect(dir)

  it('ignores Gradle keywords inside strings and unapplied variable versions', async () => {
    await write(['settings.gradle'], 'rootProject.name = "include fake"')
    await write(
      ['build.gradle'],
      `def example = "id 'org.springframework.boot'"\nplugins { id 'org.springframework.boot' version bootVersion apply false }`
    )
    expect((await detect()).map((script) => script.name)).toEqual(['clean', 'build', 'test'])
  })

  it('qualifies root launch tasks in multi-project builds', async () => {
    await write(['settings.gradle.kts'], 'include("child")')
    await write(['build.gradle.kts'], 'plugins { application }')
    const scripts = await detect()
    expect(scripts.find((script) => script.name === 'run')).toMatchObject({
      id: 'gradle:run',
      command: 'gradle :run'
    })
  })

  it.each(['linux', 'win32'] as const)(
    'uses the root wrapper and child port on %s',
    async (platform) => {
      await write(['settings.gradle.kts'], 'include("api", ":tools:cli", "api")')
      await write(
        ['build.gradle.kts'],
        'plugins { id("org.springframework.boot") version "3.4.0" apply false }'
      )
      await write(['api', 'build.gradle'], "plugins { id 'org.springframework.boot' }")
      await write(['api', 'src', 'main', 'resources', 'application.properties'], 'server.port=8092')
      await write(['tools', 'cli', 'build.gradle.kts'], 'plugins {\n application\n}')
      await write(['gradlew'], '')
      await chmod(join(dir, 'gradlew'), 0o755)
      await write(['gradlew.bat'], '')
      const scripts = await detect(platform)
      expect(scripts.map((script) => script.name)).toEqual([
        'clean',
        'build',
        'test',
        ':api:bootRun',
        ':tools:cli:run'
      ])
      expect(scripts[3]).toMatchObject({
        id: 'gradle::api:bootRun',
        command: `${platform === 'win32' ? 'gradlew.bat' : './gradlew'} :api:bootRun`,
        ports: [8092]
      })
      await expect(detect(platform)).resolves.toEqual(scripts)
    }
  )

  it('supports Groovy includes, multiline Kotlin includes and static remaps', async () => {
    await write(
      ['settings.gradle'],
      "include 'api', 'unused'\nproject(':api').projectDir = file('services/backend')"
    )
    await write(['settings.gradle.kts'], 'include(\n ":tools:cli",\n)')
    await write(
      ['services', 'backend', 'build.gradle.kts'],
      'plugins { id("org.springframework.boot") }'
    )
    await write(['tools', 'cli', 'build.gradle'], "apply plugin: 'application'")
    expect((await detect()).map((script) => script.name)).toEqual([
      'clean',
      'build',
      'test',
      ':api:bootRun',
      ':tools:cli:run'
    ])
  })

  it('ignores comments, included builds and plugins in settings', async () => {
    await write(
      ['settings.gradle'],
      '// include "fake"\n/* include "other" */\nincludeBuild("external")\nplugins { id("org.springframework.boot") }\ninclude "missing"'
    )
    await write(['build.gradle'], '// id "org.springframework.boot"\n/* application { } */')
    expect((await detect()).map((script) => script.name)).toEqual(['clean', 'build', 'test'])
  })

  it.each(['apply false', 'apply(false)', '\napply false'])(
    'does not launch unapplied plugins with %s',
    async (suffix) => {
      await write(
        ['build.gradle.kts'],
        `plugins { id("org.springframework.boot") version "3.4.0" ${suffix}\n id("application") ${suffix} }`
      )
      expect((await detect()).map((script) => script.name)).toEqual(['clean', 'build', 'test'])
    }
  )

  it('rejects a child directory linked outside the project', async () => {
    await write(['settings.gradle.kts'], 'include("outside")')
    const outside = await mkdtemp(join(tmpdir(), 'devhub-gradle-outside-'))
    try {
      await symlink(
        outside,
        join(dir, 'outside'),
        process.platform === 'win32' ? 'junction' : 'dir'
      )
      await expect(detect()).rejects.toThrow('不能通过链接指向项目外部')
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  it.each([
    'include("../outside")',
    'include("api;echo bad")',
    'include("$module")',
    'include(module)',
    'include("api", variable)',
    'include("api")\nproject(":api").projectDir = file("../outside")',
    'include("api")\nproject(":api").projectDir = File(rootDir, "api")'
  ])('rejects unsafe or unsupported settings: %s', async (settings) => {
    await write(['settings.gradle.kts'], settings)
    await expect(detect()).rejects.toThrow('Gradle')
  })
})
