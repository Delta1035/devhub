import { readdir } from 'fs/promises'
import { join } from 'path'
import type { Script } from '@devhub/shared'
import { parseGoPort } from '../ports/infer-ports'
import { exists, readOptionalFile } from './fs-utils'
import type { ScriptDetector } from './types'

const baseTasks: [task: string, command: string, description: string][] = [
  ['build', 'go build ./...', '编译构建所有包'],
  ['test', 'go test ./...', '运行单元测试'],
  ['test:v', 'go test -v ./...', '运行单元测试（详细输出）'],
  ['vet', 'go vet ./...', '代码静态分析检查'],
  ['tidy', 'go mod tidy', '整理与清理模块依赖']
]

export const goDetector: ScriptDetector = {
  source: 'go',

  async detect(dir) {
    const goMod = await readOptionalFile(join(dir, 'go.mod'))
    if (goMod === null) return []

    const scripts: Script[] = []

    // 1. Detect root runnable package (main.go or any package main file in root)
    const rootHasMain = await detectRootMain(dir)
    if (rootHasMain.isMain) {
      scripts.push({
        id: 'go:run',
        name: 'run',
        source: 'go',
        command: 'go run .',
        description: '运行主程序 (go run .)',
        ...(rootHasMain.port ? { ports: [rootHasMain.port], portsInferred: true } : {})
      })
    }

    // 2. Detect multi-service entry points under cmd/<app>/
    const cmdEntries = await detectCmdEntries(dir)
    for (const entry of cmdEntries) {
      scripts.push({
        id: `go:run:${entry.name}`,
        name: `run:${entry.name}`,
        source: 'go',
        command: `go run ./cmd/${entry.name}`,
        description: `运行 cmd/${entry.name} (go run ./cmd/${entry.name})`,
        ...(entry.port ? { ports: [entry.port], portsInferred: true } : {})
      })
    }

    // 3. Common lifecycle commands
    for (const [task, command, description] of baseTasks) {
      scripts.push({
        id: `go:${task}`,
        name: task,
        source: 'go',
        command,
        description
      })
    }

    return scripts
  }
}

export const createGoDetector = (): ScriptDetector => goDetector

interface RootMainResult {
  isMain: boolean
  port: number | null
}

async function detectRootMain(dir: string): Promise<RootMainResult> {
  const mainFile = join(dir, 'main.go')
  if (await exists(mainFile)) {
    const content = await readOptionalFile(mainFile)
    return {
      isMain: true,
      port: content ? parseGoPort(content) : null
    }
  }

  // Look for any other .go file in the root that defines "package main"
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.go') && !entry.name.endsWith('_test.go')) {
        const content = await readOptionalFile(join(dir, entry.name))
        if (content && /^\s*package\s+main\b/m.test(content)) {
          return {
            isMain: true,
            port: parseGoPort(content)
          }
        }
      }
    }
  } catch {
    // Non-fatal, return negative
  }

  return { isMain: false, port: null }
}

interface CmdEntry {
  name: string
  port: number | null
}

async function detectCmdEntries(dir: string): Promise<CmdEntry[]> {
  const cmdDir = join(dir, 'cmd')
  if (!(await exists(cmdDir))) return []

  const results: CmdEntry[] = []
  try {
    const entries = await readdir(cmdDir, { withFileTypes: true })
    const subdirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const subdir of subdirs) {
      const subPath = join(cmdDir, subdir.name)
      const subFiles = await readdir(subPath, { withFileTypes: true }).catch(() => [])
      const goFiles = subFiles.filter((f) => f.isFile() && f.name.endsWith('.go'))
      if (goFiles.length === 0) continue

      let port: number | null = null
      const preferredMain = goFiles.find((f) => f.name === 'main.go') ?? goFiles[0]
      if (preferredMain) {
        const content = await readOptionalFile(join(subPath, preferredMain.name))
        if (content) port = parseGoPort(content)
      }

      results.push({ name: subdir.name, port })
    }
  } catch {
    // If cmd is unreadable, ignore
  }

  return results
}
