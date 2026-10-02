import { join } from 'path'
import type { Script } from '@devhub/shared'
import { readOptionalFile, resolveWrapper } from './fs-utils'
import type { ScriptDetector } from './types'

export interface GradleDetectorDeps {
  platform: NodeJS.Platform
}

// A multi-project root sometimes has only a settings file.
const buildFiles = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']

const baseTasks: [task: string, description: string][] = [
  ['clean', '清理构建产物'],
  ['build', '构建（含测试）'],
  ['test', '运行测试']
]

// Plain text matching, Groovy and Kotlin DSL. The quoted plugin id excludes dependency
// coordinates such as 'org.springframework.boot:spring-boot-starter-web'.
const springBootPlugin = /['"]org\.springframework\.boot['"]/
const applicationPlugin = [
  /\bid\s*\(?\s*['"]application['"]/, // id 'application' / id("application")
  /\bapply\s+plugin\s*:\s*['"]application['"]/,
  /^\s*application\b/m // Kotlin `plugins { application }` or an `application { … }` block
]

export function createGradleDetector({ platform }: GradleDetectorDeps): ScriptDetector {
  return {
    source: 'gradle',

    async detect(dir) {
      const contents = await Promise.all(
        buildFiles.map((file) => readOptionalFile(join(dir, file)))
      )
      const present = contents.filter((content) => content !== null)
      if (present.length === 0) return []
      const build = present.join('\n')

      const executable = await resolveWrapper(dir, platform, {
        win32: 'gradlew.bat',
        posix: 'gradlew',
        fallback: 'gradle'
      })
      const tasks = [...baseTasks]
      if (springBootPlugin.test(build)) tasks.push(['bootRun', '运行 Spring Boot 应用'])
      if (applicationPlugin.some((pattern) => pattern.test(build))) tasks.push(['run', '运行应用'])

      return tasks.map(([task, description]): Script => ({
        id: `gradle:${task}`,
        name: task,
        source: 'gradle',
        command: `${executable} ${task}`,
        description
      }))
    }
  }
}
