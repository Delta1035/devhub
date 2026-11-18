import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPythonDetector, parsePipfileScripts, parsePyprojectScripts } from './python-detector'

describe('createPythonDetector', () => {
  let dir: string
  const detector = createPythonDetector({ platform: 'linux' })

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-python-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns empty array when no Python markers exist', async () => {
    const scripts = await detector.detect(dir)
    expect(scripts).toEqual([])
  })

  it('detects a pyproject.toml project with uv lockfile and console scripts', async () => {
    const toml = `
[project]
name = "my-app"
version = "0.1.0"

[project.scripts]
my-cli = "my_app.cli:main"

[tool.taskipy.tasks]
serve = "uvicorn my_app.api:app --port 8080"
`
    await writeFile(join(dir, 'pyproject.toml'), toml)
    await writeFile(join(dir, 'uv.lock'), '')

    const scripts = await detector.detect(dir)
    expect(scripts.every((s) => s.source === 'python')).toBe(true)

    const cli = scripts.find((s) => s.name === 'my-cli')
    expect(cli).toEqual({
      id: 'python:my-cli',
      name: 'my-cli',
      source: 'python',
      command: 'uv run my-cli',
      description: '运行脚本 (my_app.cli:main)'
    })

    const serve = scripts.find((s) => s.name === 'serve')
    expect(serve).toEqual({
      id: 'python:serve',
      name: 'serve',
      source: 'python',
      command: 'uv run serve',
      description: '运行脚本 (uvicorn my_app.api:app --port 8080)',
      ports: [8080],
      portsInferred: true
    })

    const sync = scripts.find((s) => s.name === 'sync')
    expect(sync).toEqual({
      id: 'python:sync',
      name: 'sync',
      source: 'python',
      command: 'uv sync',
      description: '同步虚拟环境依赖 (uv sync)'
    })
  })

  it('detects a Poetry project with declared scripts and poetry install', async () => {
    const toml = `
[tool.poetry]
name = "poetry-demo"

[tool.poetry.scripts]
start-api = "demo.server:run"
`
    await writeFile(join(dir, 'pyproject.toml'), toml)
    await writeFile(join(dir, 'poetry.lock'), '')

    const scripts = await detector.detect(dir)
    const startScript = scripts.find((s) => s.name === 'start-api')
    expect(startScript?.command).toBe('poetry run start-api')

    const installScript = scripts.find((s) => s.name === 'install')
    expect(installScript?.command).toBe('poetry install')
  })

  it('detects Django project and generates manage.py commands with port 8000', async () => {
    await writeFile(join(dir, 'manage.py'), '#!/usr/bin/env python\n')

    const scripts = await detector.detect(dir)
    const names = scripts.map((s) => s.name)
    expect(names).toContain('runserver')
    expect(names).toContain('migrate')
    expect(names).toContain('makemigrations')
    expect(names).toContain('shell')
    expect(names).toContain('test')

    const runserver = scripts.find((s) => s.name === 'runserver')
    expect(runserver).toEqual({
      id: 'python:runserver',
      name: 'runserver',
      source: 'python',
      command: 'python3 manage.py runserver',
      description: '启动 Django 开发服务器',
      ports: [8000],
      portsInferred: true
    })
  })

  it('detects standalone main.py and discovers FastAPI/uvicorn reload task', async () => {
    await writeFile(
      join(dir, 'main.py'),
      `from fastapi import FastAPI
app = FastAPI()
`
    )

    const scripts = await detector.detect(dir)
    const runScript = scripts.find((s) => s.name === 'run')
    expect(runScript).toBeDefined()
    expect(runScript?.command).toBe('python3 main.py')

    const devScript = scripts.find((s) => s.name === 'dev')
    expect(devScript).toEqual({
      id: 'python:dev',
      name: 'dev',
      source: 'python',
      command: 'python3 uvicorn main:app --reload',
      description: '启动 Uvicorn 开发服务器 (热重载)',
      ports: [8000],
      portsInferred: true
    })
  })

  it('prefers local virtualenv over system python', async () => {
    const venvBin = join(dir, '.venv', 'bin')
    await mkdir(venvBin, { recursive: true })
    await writeFile(join(venvBin, 'python'), '')
    await writeFile(join(venvBin, 'pip'), '')
    await writeFile(join(dir, 'main.py'), 'print("hello")\n')

    const scripts = await detector.detect(dir)
    const runScript = scripts.find((s) => s.name === 'run')
    expect(runScript?.command).toBe('.venv/bin/python main.py')
  })

  it('detects requirements.txt and pytest tests directory', async () => {
    await writeFile(join(dir, 'requirements.txt'), 'pytest>=8.0\n')
    await mkdir(join(dir, 'tests'), { recursive: true })

    const scripts = await detector.detect(dir)
    const install = scripts.find((s) => s.name === 'install')
    expect(install?.command).toBe('pip3 install -r requirements.txt')

    const test = scripts.find((s) => s.name === 'test')
    expect(test?.command).toBe('python3 -m pytest')
  })
})

describe('parsePyprojectScripts', () => {
  it('extracts scripts across standard sections', () => {
    const content = `
[project.scripts]
cli = "my_mod.cli:main"
other = 'my_mod.other:run'

# comments should be ignored
[tool.poetry.scripts]
poet = "poet.app:entry"

[tool.taskipy.tasks]
lint = "flake8 ."
`
    const parsed = parsePyprojectScripts(content)
    expect(parsed).toEqual([
      { name: 'cli', raw: 'my_mod.cli:main', isEntrypoint: true },
      { name: 'other', raw: 'my_mod.other:run', isEntrypoint: true },
      { name: 'poet', raw: 'poet.app:entry', isEntrypoint: true },
      { name: 'lint', raw: 'flake8 .', isEntrypoint: false }
    ])
  })
})

describe('parsePipfileScripts', () => {
  it('extracts scripts from [scripts] block', () => {
    const content = `
[[source]]
url = "https://pypi.org/simple"

[scripts]
server = "python manage.py runserver"
test = "pytest"

[packages]
requests = "*"
`
    const parsed = parsePipfileScripts(content)
    expect(parsed).toEqual([
      { name: 'server', command: 'python manage.py runserver' },
      { name: 'test', command: 'pytest' }
    ])
  })
})
