import { join } from 'path'
import type { Script } from '@devhub/shared'
import { exists, readOptionalFile } from './fs-utils'
import type { ScriptDetector } from './types'

export interface MavenDetectorDeps {
  platform: NodeJS.Platform
}

const baseGoals: [goal: string, description: string][] = [
  ['clean', '清理构建产物'],
  ['compile', '编译'],
  ['test', '运行测试'],
  ['package', '打包（含测试）'],
  ['install', '安装到本地仓库（含测试）']
]

// Plain text match instead of XML parsing: a broken pom is reported by Maven itself.
const springBootPlugin = 'spring-boot-maven-plugin'

export function createMavenDetector({ platform }: MavenDetectorDeps): ScriptDetector {
  return {
    source: 'maven',

    async detect(dir) {
      const pom = await readOptionalFile(join(dir, 'pom.xml'))
      if (pom === null) return []

      const executable = await resolveExecutable(dir, platform)
      const goals = [...baseGoals]
      if (pom.includes(springBootPlugin)) goals.push(['spring-boot:run', '运行 Spring Boot 应用'])

      return goals.map(([goal, description]): Script => ({
        id: `maven:${goal}`,
        name: goal,
        source: 'maven',
        command: `${executable} ${goal}`,
        description
      }))
    }
  }
}

/** Prefers the project's wrapper for the current platform; falls back to `mvn` on PATH. */
async function resolveExecutable(dir: string, platform: NodeJS.Platform): Promise<string> {
  const [wrapperFile, invocation] =
    platform === 'win32' ? ['mvnw.cmd', 'mvnw.cmd'] : ['mvnw', './mvnw']
  return (await exists(join(dir, wrapperFile))) ? invocation : 'mvn'
}
