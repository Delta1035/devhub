import { isAbsolute, join, relative, resolve } from 'path'
import { parse, YAMLParseError } from 'yaml'
import { projectConfigSchema, type Script } from '@devhub/shared'
import { inferNpmPorts } from '../ports/infer-ports'
import { readOptionalFile } from './fs-utils'
import type { ScriptDetector } from './types'

export interface ConfigDetectorDeps {
  platform: NodeJS.Platform
}

export const configFileNames = ['.devhub.yaml', '.devhub.yml']

/**
 * Custom scripts from the project's optional `.devhub.yaml`, for commands no detector finds
 * (docker compose, one module of a multi-module build, commands with special flags).
 * Errors say where the file is wrong, since the user wrote it by hand.
 */
export function createConfigDetector({ platform }: ConfigDetectorDeps): ScriptDetector {
  return {
    source: 'custom',

    async detect(dir) {
      let fileName = ''
      let text: string | null = null
      for (const name of configFileNames) {
        text = await readOptionalFile(join(dir, name))
        fileName = name
        if (text !== null) break
      }
      if (text === null) return []

      let raw: unknown
      try {
        raw = parse(text) ?? {}
      } catch (error) {
        const line = error instanceof YAMLParseError ? error.linePos?.[0]?.line : undefined
        const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
        throw new Error(`${fileName}${line ? ` 第 ${line} 行` : ''}不是有效的 YAML：${reason}`, {
          cause: error
        })
      }

      const parsed = projectConfigSchema.safeParse(raw)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        const where = issue?.path.length ? issue.path.join('.') : '文件'
        throw new Error(`${fileName} 格式不正确：${where} ${issue?.message ?? ''}`.trim())
      }

      const scripts: Script[] = []
      for (const [name, entry] of Object.entries(parsed.data.scripts)) {
        const command =
          typeof entry.command === 'string'
            ? entry.command
            : platform === 'win32'
              ? entry.command.windows
              : entry.command.linux
        // A command written only for the other platform is simply not offered here.
        if (!command) continue

        if (entry.cwd !== undefined) {
          const target = resolve(dir, entry.cwd)
          const inside = relative(dir, target)
          if (inside.startsWith('..') || isAbsolute(inside)) {
            throw new Error(`${fileName} 中脚本 ${name} 的 cwd 必须在项目目录内：${entry.cwd}`)
          }
        }

        const ports = entry.ports ?? (entry.port ? [entry.port] : inferNpmPorts(command))
        if (entry.health && ports.length === 0) {
          throw new Error(`${fileName} 中脚本 ${name} 设置了 health，但不知道端口：请同时填写 port`)
        }
        scripts.push({
          id: `custom:${name}`,
          name,
          source: 'custom',
          command,
          ...(entry.cwd ? { cwd: entry.cwd } : {}),
          ...(entry.description ? { description: entry.description } : {}),
          ...(ports.length > 0 ? { ports } : {}),
          ...(entry.health ? { healthPath: entry.health } : {})
        })
      }
      return scripts
    }
  }
}
