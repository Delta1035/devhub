import { z } from 'zod'

interface Element {
  name: string
  text: string
  children: Element[]
}

const parentPathSchema = z
  .string()
  .trim()
  .max(240)
  .regex(/^[A-Za-z0-9_. /-]*$/)
  .refine((value) => !value.startsWith('/'))

const moduleSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) => value.split('/').every((part) => /^[A-Za-z0-9_][A-Za-z0-9_. -]*$/.test(part)),
    '模块必须是项目内的静态相对目录，不能包含 shell 字符或路径穿越'
  )

/** Small, non-expanding XML reader: only direct build/plugins and modules are inspected. */
export function readMavenPom(xml: string): {
  springBoot: boolean
  inheritSpringBoot: boolean
  aggregator: boolean
  parentPath: string | null
  modules: string[]
} {
  const document: Element = { name: '', text: '', children: [] }
  const stack = [document]
  const source = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '')
  if (/<!/.test(source)) throw new Error('pom.xml 不支持 DTD 或特殊 XML 声明')
  for (const token of source.match(/<[^>]*>|[^<]+/g) ?? []) {
    const current = stack.at(-1)!
    if (!token.startsWith('<')) {
      current.text += token
      continue
    }
    const closing = /^<\/([\w:.-]+)\s*>$/.exec(token)
    if (closing) {
      if (stack.length === 1 || current.name !== closing[1]?.split(':').at(-1)) {
        throw new Error('pom.xml XML 标签不匹配')
      }
      stack.pop()
      continue
    }
    const opening = /^<([\w:.-]+)(?:\s[^<>]*)?\s*\/?\s*>$/.exec(token)
    if (!opening?.[1]) throw new Error('pom.xml XML 标签无效')
    const element: Element = { name: opening[1].split(':').at(-1)!, text: '', children: [] }
    current.children.push(element)
    if (!/\/\s*>$/.test(token)) stack.push(element)
  }
  if (stack.length !== 1 || document.children.length !== 1) {
    throw new Error('pom.xml XML 结构不完整')
  }
  const project = document.children[0]!
  if (project.name !== 'project') throw new Error('pom.xml 缺少 project 根元素')
  const children = (node: Element, name: string): Element[] =>
    node.children.filter((child) => child.name === name)
  const plugins = children(project, 'build').flatMap((build) =>
    children(build, 'plugins').flatMap((list) => children(list, 'plugin'))
  )
  const bootPlugins = plugins.filter(
    (plugin) =>
      children(plugin, 'artifactId').some((id) => id.text.trim() === 'spring-boot-maven-plugin') &&
      children(plugin, 'groupId').every((id) => id.text.trim() === 'org.springframework.boot')
  )
  const springBoot = bootPlugins.length > 0
  const inheritSpringBoot = bootPlugins.some((plugin) =>
    children(plugin, 'inherited').every((value) => value.text.trim() !== 'false')
  )
  const aggregator = children(project, 'packaging').some((value) => value.text.trim() === 'pom')
  const parent = children(project, 'parent')[0]
  const parentPathResult = parent
    ? parentPathSchema.safeParse(children(parent, 'relativePath')[0]?.text ?? '../pom.xml')
    : null
  if (parentPathResult && !parentPathResult.success) throw new Error('pom.xml 父模块路径无效')
  const parentPath = parentPathResult?.success ? parentPathResult.data : null
  const modules = children(project, 'modules').flatMap((list) =>
    children(list, 'module').map((module) => {
      const result = moduleSchema.safeParse(module.text)
      if (!result.success || module.children.length > 0) {
        throw new Error(`pom.xml 模块路径无效：${module.text.trim()}`)
      }
      return result.data
    })
  )
  return { springBoot, inheritSpringBoot, aggregator, parentPath, modules }
}
