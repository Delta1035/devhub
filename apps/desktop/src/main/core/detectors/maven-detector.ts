import { realpath } from 'fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import type { Script } from '@devhub/shared'
import { readSpringPort } from '../ports/infer-ports'
import { readOptionalFile, resolveWrapper } from './fs-utils'
import type { ScriptDetector } from './types'
import { readMavenPom } from './maven-pom'

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

export function createMavenDetector({ platform }: MavenDetectorDeps): ScriptDetector {
  return {
    source: 'maven',

    async detect(dir) {
      const pom = await readOptionalFile(join(dir, 'pom.xml'))
      if (pom === null) return []
      const rootPom = readMavenPom(pom)

      const executable = await resolveWrapper(dir, platform, {
        win32: 'mvnw.cmd',
        posix: 'mvnw',
        fallback: 'mvn'
      })
      const goals = [...baseGoals]
      if (rootPom.springBoot && !rootPom.aggregator)
        goals.push(['spring-boot:run', '运行 Spring Boot 应用'])

      const springPort = rootPom.springBoot ? await readSpringPort(dir) : null
      const scripts = goals.map(([goal, description]): Script => ({
        id: `maven:${goal}`,
        name: goal,
        source: 'maven',
        command: `${executable}${goal === 'spring-boot:run' && rootPom.modules.length > 0 ? ' -N' : ''} ${goal}`,
        description,
        ...(goal === 'spring-boot:run' && springPort ? { ports: [springPort] } : {})
      }))
      const root = await realpath(dir)
      const visited = new Set([root])
      async function visit(
        parentDir: string,
        modules: string[],
        depth: number,
        inheritedBoot: boolean
      ): Promise<void> {
        if (depth > 3) return
        for (const module of modules) {
          const moduleDir = join(parentDir, ...module.split('/'))
          const canonical = await realpath(moduleDir).catch((error: unknown) => {
            throw new Error(`无法读取 Maven 模块目录：${module}`, { cause: error })
          })
          const local = relative(root, canonical)
          if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
            throw new Error(`Maven 模块超出项目目录：${module}`)
          }
          if (visited.has(canonical)) continue
          visited.add(canonical)
          const modulePom = await readOptionalFile(join(moduleDir, 'pom.xml'))
          if (modulePom === null) throw new Error(`Maven 模块缺少 pom.xml：${module}`)
          const child = readMavenPom(modulePom)
          // Only compare to the known reactor parent; never read/resolve an external parent.
          const inheritsBoot =
            inheritedBoot &&
            !!child.parentPath &&
            resolve(moduleDir, child.parentPath) === resolve(parentDir, 'pom.xml')
          const selector = relative(dir, moduleDir).split(sep).join('/')
          if ((child.springBoot || inheritsBoot) && !child.aggregator) {
            const port = await readSpringPort(moduleDir)
            const target = selector.includes(' ') ? `"${selector}"` : selector
            scripts.push(
              {
                id: `maven:${selector}:install-dependencies`,
                name: `${selector}:install-dependencies`,
                source: 'maven',
                command: `${executable} -pl ${target} -am install -DskipTests`,
                description: '构建模块及其依赖并安装到本地仓库（跳过测试）'
              },
              {
                id: `maven:${selector}:spring-boot:run`,
                name: `${selector}:spring-boot:run`,
                source: 'maven',
                command: `${executable} -pl ${target} spring-boot:run`,
                description: '运行模块 Spring Boot 应用（先构建依赖）',
                ports: [port]
              }
            )
          }
          await visit(
            moduleDir,
            child.modules,
            depth + 1,
            child.springBoot ? child.inheritSpringBoot : inheritsBoot
          )
        }
      }
      await visit(dir, rootPom.modules, 1, rootPom.inheritSpringBoot)
      return scripts
    }
  }
}
