import { realpath } from 'fs/promises'
import { isAbsolute, join, relative } from 'path'
import type { Script } from '@devhub/shared'
import { readSpringPort } from '../ports/infer-ports'
import { readOptionalFile, resolveWrapper } from './fs-utils'
import type { ScriptDetector } from './types'
import { gradleLaunchTasks, readGradleProjects } from './gradle-settings'

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

export function createGradleDetector({ platform }: GradleDetectorDeps): ScriptDetector {
  return {
    source: 'gradle',

    async detect(dir) {
      const contents = await Promise.all(
        buildFiles.map((file) => readOptionalFile(join(dir, file)))
      )
      const present = contents.filter((content) => content !== null)
      if (present.length === 0) return []
      const build = contents
        .slice(0, 2)
        .filter((content) => content !== null)
        .join('\n')
      const settings = contents
        .slice(2)
        .filter((content) => content !== null)
        .join('\n')

      const projects = readGradleProjects(settings)
      const executable = await resolveWrapper(dir, platform, {
        win32: 'gradlew.bat',
        posix: 'gradlew',
        fallback: 'gradle'
      })
      const tasks = [...baseTasks]
      const launches = gradleLaunchTasks(build)
      if (launches.includes('bootRun')) tasks.push(['bootRun', '运行 Spring Boot 应用'])
      if (launches.includes('run')) tasks.push(['run', '运行应用'])

      const springPort = launches.includes('bootRun') ? await readSpringPort(dir) : null
      const scripts = tasks.map(([task, description]): Script => ({
        id: `gradle:${task}`,
        name: task,
        source: 'gradle',
        command: `${executable} ${projects.length && launches.includes(task) ? ':' : ''}${task}`,
        description,
        ...(task === 'bootRun' && springPort ? { ports: [springPort] } : {})
      }))
      for (const project of projects) {
        const childDir = join(dir, ...project.segments)
        try {
          const childRelative = relative(await realpath(dir), await realpath(childDir))
          if (childRelative.startsWith('..') || isAbsolute(childRelative)) {
            throw new Error('Gradle 子项目目录不能通过链接指向项目外部')
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        const childBuild = await Promise.all(
          buildFiles.slice(0, 2).map((file) => readOptionalFile(join(childDir, file)))
        )
        for (const task of gradleLaunchTasks(
          childBuild.filter((text) => text !== null).join('\n')
        )) {
          const name = `${project.taskPath}:${task}`
          scripts.push({
            id: `gradle:${name}`,
            name,
            source: 'gradle',
            command: `${executable} ${name}`,
            description: task === 'bootRun' ? '运行 Spring Boot 子项目' : '运行应用子项目',
            ...(task === 'bootRun' ? { ports: [await readSpringPort(childDir)] } : {})
          })
        }
      }
      return scripts
    }
  }
}
