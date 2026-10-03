import { z } from 'zod'

const projectPath = z.string().regex(/^:?[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/)
const directoryPath = z.string().regex(/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/)

/** Remove comments without interpreting Gradle code or changing quoted strings. */
export function stripGradleComments(content: string): string {
  return content.replace(/(['"])(?:\\.|(?!\1)[^\\])*?\1|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (part) =>
    part.startsWith('/') ? part.replace(/[^\n]/g, ' ') : part
  )
}

export interface GradleProject {
  taskPath: string
  segments: string[]
}

function codeOnly(content: string): string {
  return content.replace(/(['"])(?:\\.|(?!\1)[^\\])*?\1/g, (part) => part.replace(/[^\n]/g, ' '))
}

/** Static includes only; no evaluation of Groovy/Kotlin, interpolation or filesystem scans. */
export function readGradleProjects(content: string): GradleProject[] {
  const settings = stripGradleComments(content)
  const code = codeOnly(settings)
  const projects = new Map<string, GradleProject>()
  const includes = /\binclude\b\s*(?:\(([^)]*)\)|([^\n;]+))/g
  for (const match of settings.matchAll(includes)) {
    if (code.slice(match.index, match.index + 7) !== 'include') continue
    const args = match[1] ?? match[2] ?? ''
    if (!/^\s*(['"])[^'"\n]+\1(?:\s*,\s*(['"])[^'"\n]+\2)*\s*,?\s*$/.test(args)) {
      throw new Error('Gradle include 仅支持静态项目名称，请用 .devhub.yaml 配置动态项目')
    }
    for (const literal of args.matchAll(/['"]([^'"]+)['"]/g)) {
      const parsed = projectPath.safeParse(literal[1])
      if (!parsed.success) throw new Error('Gradle include 包含不安全的项目名称')
      const segments = parsed.data.replace(/^:/, '').split(':')
      const taskPath = `:${segments.join(':')}`
      projects.set(taskPath, { taskPath, segments })
    }
  }
  const remaps = /\bproject\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\.projectDir\s*=\s*([^\n;]+)/g
  for (const match of settings.matchAll(remaps)) {
    if (code.slice(match.index, match.index + 7) !== 'project') continue
    const key = projectPath.safeParse(match[1])
    const value = /^file\s*\(\s*['"]([^'"]+)['"]\s*\)\s*$/.exec(match[2] ?? '')
    const directory = directoryPath.safeParse(value?.[1])
    if (!key.success || !directory.success) {
      throw new Error('Gradle projectDir 仅支持项目目录内的静态 file("相对路径")')
    }
    const project = projects.get(`:${key.data.replace(/^:/, '')}`)
    if (project) project.segments = directory.data.split('/')
  }
  return [...projects.values()]
}

export function gradleLaunchTasks(content: string): string[] {
  const build = stripGradleComments(content)
  const code = codeOnly(build)
  const tasks = new Set<string>()
  const declarations =
    /\bid\s*(?:\(\s*['"]([^'"]+)['"]\s*\)|['"]([^'"]+)['"])(\s*(?:version\s*(?:\([^)]*\)|['"][^'"]+['"]|[A-Za-z_][\w.]*))?\s*(?:apply\s*(?:\(\s*false\s*\)|false\b))?)/g
  for (const match of build.matchAll(declarations)) {
    if (code.slice(match.index, match.index + 2) !== 'id') continue
    if (/\bapply\s*(?:\(\s*false\s*\)|false\b)/.test(match[3] ?? '')) continue
    const plugin = match[1] ?? match[2]
    if (plugin === 'org.springframework.boot') tasks.add('bootRun')
    if (plugin === 'application') tasks.add('run')
  }
  for (const match of build.matchAll(
    /\bapply\s+plugin\s*:\s*['"](org\.springframework\.boot|application)['"]/g
  )) {
    if (code.slice(match.index, match.index + 5) === 'apply')
      tasks.add(match[1] === 'application' ? 'run' : 'bootRun')
  }
  if (/(?:^|[{;\n])\s*application\b/.test(code)) tasks.add('run')
  return ['bootRun', 'run'].filter((task) => tasks.has(task))
}
