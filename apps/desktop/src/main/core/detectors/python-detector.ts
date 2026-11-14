import { join } from 'path'
import type { Script } from '@devhub/shared'
import { inferNpmPorts } from '../ports/infer-ports'
import { exists, readOptionalFile } from './fs-utils'
import type { ScriptDetector } from './types'

export interface PythonDetectorDeps {
  platform: NodeJS.Platform
}

export type PythonManager = 'uv' | 'poetry' | 'pdm' | 'pipenv' | 'venv' | 'system'

export interface PythonRunnerInfo {
  manager: PythonManager
  runner: string
  python: string
  pip: string
}

export function createPythonDetector({ platform }: PythonDetectorDeps): ScriptDetector {
  return {
    source: 'python',

    async detect(dir) {
      const pyproject = await readOptionalFile(join(dir, 'pyproject.toml'))
      const hasRequirements = await exists(join(dir, 'requirements.txt'))
      const hasPipfile = await exists(join(dir, 'Pipfile'))
      const hasManagePy = await exists(join(dir, 'manage.py'))
      const hasSetupPy =
        (await exists(join(dir, 'setup.py'))) || (await exists(join(dir, 'setup.cfg')))
      const entryFile = await findEntryFile(dir)
      const hasVenv = (await exists(join(dir, '.venv'))) || (await exists(join(dir, 'venv')))

      // Not a Python project if none of the standard markers exist
      if (
        pyproject === null &&
        !hasRequirements &&
        !hasPipfile &&
        !hasManagePy &&
        !hasSetupPy &&
        entryFile === null &&
        !hasVenv
      ) {
        return []
      }

      const envInfo = await resolvePythonRunner(dir, platform, pyproject)
      const scripts: Script[] = []

      // 1. Scripts declared in pyproject.toml
      if (pyproject !== null) {
        const declared = parsePyprojectScripts(pyproject)
        for (const item of declared) {
          const command = buildDeclaredScriptCommand(item, envInfo)
          const ports = inferNpmPorts(`${command} ${item.raw}`)
          scripts.push({
            id: `python:${item.name}`,
            name: item.name,
            source: 'python',
            command,
            description: `运行脚本 (${item.raw})`,
            ...(ports.length > 0 ? { ports, portsInferred: true } : {})
          })
        }
      }

      // 2. Scripts declared in Pipfile
      if (hasPipfile) {
        const pipfileContent = await readOptionalFile(join(dir, 'Pipfile'))
        if (pipfileContent) {
          const declared = parsePipfileScripts(pipfileContent)
          for (const item of declared) {
            const command = `pipenv run ${item.name}`
            const ports = inferNpmPorts(item.command)
            scripts.push({
              id: `python:${item.name}`,
              name: item.name,
              source: 'python',
              command,
              description: `Pipfile 脚本 (${item.command})`,
              ...(ports.length > 0 ? { ports, portsInferred: true } : {})
            })
          }
        }
      }

      // 3. Django commands if manage.py is present
      if (hasManagePy) {
        const djangoCommands: [name: string, subcmd: string, desc: string, defaultPort?: number][] =
          [
            ['runserver', 'runserver', '启动 Django 开发服务器', 8000],
            ['migrate', 'migrate', '执行数据库迁移'],
            ['makemigrations', 'makemigrations', '生成数据库迁移记录'],
            ['shell', 'shell', '进入 Django 交互环境'],
            ['test', 'test', '运行 Django 测试套件']
          ]

        for (const [name, subcmd, desc, defaultPort] of djangoCommands) {
          const command = `${envInfo.python} manage.py ${subcmd}`
          scripts.push({
            id: `python:${name}`,
            name,
            source: 'python',
            command,
            description: desc,
            ...(defaultPort ? { ports: [defaultPort], portsInferred: true } : {})
          })
        }
      } else {
        // 4. Common standalone entry points (main.py, app.py, server.py, run.py)
        if (entryFile) {
          const command = `${envInfo.python} ${entryFile}`
          const ports = inferNpmPorts(command)
          scripts.push({
            id: 'python:run',
            name: 'run',
            source: 'python',
            command,
            description: `运行主程序 (${entryFile})`,
            ...(ports.length > 0 ? { ports, portsInferred: true } : {})
          })

          // If entry file mentions FastAPI or Uvicorn, add uvicorn reload task
          const entryContent = await readOptionalFile(join(dir, entryFile))
          if (entryContent && /\b(FastAPI|uvicorn)\b/.test(entryContent)) {
            const moduleName = entryFile.replace(/\.py$/, '')
            const uvicornCmd = `${envInfo.runner} uvicorn ${moduleName}:app --reload`
            scripts.push({
              id: 'python:dev',
              name: 'dev',
              source: 'python',
              command: uvicornCmd,
              description: '启动 Uvicorn 开发服务器 (热重载)',
              ports: [8000],
              portsInferred: true
            })
          }
        }
      }

      // 5. Test runner (pytest)
      const hasPytest =
        (await exists(join(dir, 'pytest.ini'))) ||
        (await exists(join(dir, 'tests'))) ||
        (await exists(join(dir, 'test'))) ||
        (pyproject !== null && /pytest/i.test(pyproject))

      if (hasPytest && !scripts.some((s) => s.name === 'test')) {
        const testCmd =
          envInfo.manager === 'system' || envInfo.manager === 'venv'
            ? `${envInfo.python} -m pytest`
            : `${envInfo.runner} pytest`
        scripts.push({
          id: 'python:test',
          name: 'test',
          source: 'python',
          command: testCmd,
          description: '运行测试 (pytest)'
        })
      }

      // 6. Dependency sync / install
      if (await exists(join(dir, 'uv.lock'))) {
        scripts.push({
          id: 'python:sync',
          name: 'sync',
          source: 'python',
          command: 'uv sync',
          description: '同步虚拟环境依赖 (uv sync)'
        })
      } else if (await exists(join(dir, 'poetry.lock'))) {
        scripts.push({
          id: 'python:install',
          name: 'install',
          source: 'python',
          command: 'poetry install',
          description: '安装依赖 (poetry install)'
        })
      } else if (await exists(join(dir, 'pdm.lock'))) {
        scripts.push({
          id: 'python:install',
          name: 'install',
          source: 'python',
          command: 'pdm install',
          description: '安装依赖 (pdm install)'
        })
      } else if (hasRequirements) {
        scripts.push({
          id: 'python:install',
          name: 'install',
          source: 'python',
          command: `${envInfo.pip} install -r requirements.txt`,
          description: '安装 requirements.txt 依赖'
        })
      }

      return scripts
    }
  }
}

async function resolvePythonRunner(
  dir: string,
  platform: NodeJS.Platform,
  pyprojectText: string | null
): Promise<PythonRunnerInfo> {
  // 1. uv
  if (
    (await exists(join(dir, 'uv.lock'))) ||
    (pyprojectText && pyprojectText.includes('[tool.uv]'))
  ) {
    return { manager: 'uv', runner: 'uv run', python: 'uv run python', pip: 'uv pip' }
  }

  // 2. poetry
  if (
    (await exists(join(dir, 'poetry.lock'))) ||
    (pyprojectText && pyprojectText.includes('[tool.poetry]'))
  ) {
    return {
      manager: 'poetry',
      runner: 'poetry run',
      python: 'poetry run python',
      pip: 'poetry run pip'
    }
  }

  // 3. pdm
  if (
    (await exists(join(dir, 'pdm.lock'))) ||
    (pyprojectText && pyprojectText.includes('[tool.pdm]'))
  ) {
    return { manager: 'pdm', runner: 'pdm run', python: 'pdm run python', pip: 'pdm run pip' }
  }

  // 4. pipenv
  if ((await exists(join(dir, 'Pipfile.lock'))) || (await exists(join(dir, 'Pipfile')))) {
    return {
      manager: 'pipenv',
      runner: 'pipenv run',
      python: 'pipenv run python',
      pip: 'pipenv run pip'
    }
  }

  // 5. Local virtual environment (.venv / venv)
  const isWin = platform === 'win32'
  for (const venvName of ['.venv', 'venv']) {
    const pyPath = isWin
      ? join(dir, venvName, 'Scripts', 'python.exe')
      : join(dir, venvName, 'bin', 'python')
    if (await exists(pyPath)) {
      const relPython = isWin ? `${venvName}\\Scripts\\python` : `${venvName}/bin/python`
      const relPip = isWin ? `${venvName}\\Scripts\\pip` : `${venvName}/bin/pip`
      return { manager: 'venv', runner: relPython, python: relPython, pip: relPip }
    }
  }

  // 6. System fallback
  const sysPython = isWin ? 'python' : 'python3'
  const sysPip = isWin ? 'pip' : 'pip3'
  return { manager: 'system', runner: sysPython, python: sysPython, pip: sysPip }
}

export interface DeclaredScript {
  name: string
  raw: string
  isEntrypoint: boolean
}

export function parsePyprojectScripts(content: string): DeclaredScript[] {
  const targetSections = new Set([
    'project.scripts',
    'tool.poetry.scripts',
    'tool.pdm.scripts',
    'tool.taskipy.tasks'
  ])

  const results: DeclaredScript[] = []
  let currentSection: string | null = null

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const sectionMatch = /^\[([A-Za-z0-9_.-]+)\]$/.exec(trimmed)
    if (sectionMatch?.[1]) {
      currentSection = sectionMatch[1]
      continue
    }

    if (currentSection && targetSections.has(currentSection)) {
      const kvMatch = /^([A-Za-z0-9_.-]+)\s*=\s*["']([^"']+)["']/.exec(trimmed)
      if (kvMatch?.[1] && kvMatch[2]) {
        const name = kvMatch[1]
        const raw = kvMatch[2]
        const isEntrypoint =
          (currentSection === 'project.scripts' || currentSection === 'tool.poetry.scripts') &&
          raw.includes(':')
        results.push({ name, raw, isEntrypoint })
      }
    }
  }

  return results
}

export function parsePipfileScripts(content: string): { name: string; command: string }[] {
  const results: { name: string; command: string }[] = []
  let inScripts = false

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (/^\[scripts\]\s*$/i.test(trimmed)) {
      inScripts = true
      continue
    }

    if (trimmed.startsWith('[')) {
      inScripts = false
      continue
    }

    if (inScripts) {
      const match = /^([A-Za-z0-9_.-]+)\s*=\s*["']([^"']+)["']/.exec(trimmed)
      if (match?.[1] && match[2]) {
        results.push({ name: match[1], command: match[2] })
      }
    }
  }

  return results
}

function buildDeclaredScriptCommand(item: DeclaredScript, env: PythonRunnerInfo): string {
  if (item.isEntrypoint) {
    if (env.manager === 'system' || env.manager === 'venv') {
      const moduleName = item.raw.split(':')[0]
      return `${env.python} -m ${moduleName}`
    }
    return `${env.runner} ${item.name}`
  }

  if (env.manager === 'pdm') return `pdm run ${item.name}`
  if (env.manager === 'poetry') return `poetry run ${item.name}`
  if (env.manager === 'uv') return `uv run ${item.name}`
  return `${env.runner} ${item.raw}`
}

async function findEntryFile(dir: string): Promise<string | null> {
  const candidates = ['main.py', 'app.py', 'server.py', 'run.py']
  for (const name of candidates) {
    if (await exists(join(dir, name))) return name
  }
  return null
}
