import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { goDetector } from './go-detector'

describe('goDetector', () => {
  let dir: string
  const detector = goDetector

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-go-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns empty array when go.mod does not exist', async () => {
    const scripts = await detector.detect(dir)
    expect(scripts).toEqual([])
  })

  it('detects a library module with standard lifecycle scripts', async () => {
    await writeFile(join(dir, 'go.mod'), 'module example.com/mylib\n\ngo 1.22\n')

    const scripts = await detector.detect(dir)
    expect(scripts.map((s) => s.name)).toEqual(['build', 'test', 'test:v', 'vet', 'tidy'])
    expect(scripts.every((s) => s.source === 'go')).toBe(true)
    expect(scripts.find((s) => s.name === 'build')).toMatchObject({
      command: 'go build ./...',
      description: '编译构建所有包'
    })
    expect(scripts.find((s) => s.name === 'test')).toMatchObject({
      command: 'go test ./...',
      description: '运行单元测试'
    })
    expect(scripts.find((s) => s.name === 'tidy')).toMatchObject({
      command: 'go mod tidy',
      description: '整理与清理模块依赖'
    })
  })

  it('detects root main.go and infers port from http.ListenAndServe', async () => {
    await writeFile(join(dir, 'go.mod'), 'module example.com/myapp\n\ngo 1.22\n')
    await writeFile(
      join(dir, 'main.go'),
      `package main

import "net/http"

func main() {
    http.ListenAndServe(":8080", nil)
}
`
    )

    const scripts = await detector.detect(dir)
    const runScript = scripts.find((s) => s.name === 'run')
    expect(runScript).toBeDefined()
    expect(runScript).toEqual({
      id: 'go:run',
      name: 'run',
      source: 'go',
      command: 'go run .',
      description: '运行主程序 (go run .)',
      ports: [8080],
      portsInferred: true
    })
  })

  it('detects root non-main.go file with package main', async () => {
    await writeFile(join(dir, 'go.mod'), 'module example.com/myapp\n\ngo 1.22\n')
    await writeFile(
      join(dir, 'server.go'),
      `package main

func main() {}
`
    )

    const scripts = await detector.detect(dir)
    const runScript = scripts.find((s) => s.name === 'run')
    expect(runScript).toBeDefined()
    expect(runScript?.command).toBe('go run .')
    expect(runScript?.ports).toBeUndefined()
  })

  it('detects multi-command applications under cmd/<name>/', async () => {
    await writeFile(join(dir, 'go.mod'), 'module example.com/myapp\n\ngo 1.22\n')
    const cmdApi = join(dir, 'cmd', 'api')
    const cmdWorker = join(dir, 'cmd', 'worker')
    await mkdir(cmdApi, { recursive: true })
    await mkdir(cmdWorker, { recursive: true })

    await writeFile(
      join(cmdApi, 'main.go'),
      `package main

import "net/http"

func main() {
    http.ListenAndServe(":9090", nil)
}
`
    )
    await writeFile(
      join(cmdWorker, 'worker.go'),
      `package main

func main() {}
`
    )

    const scripts = await detector.detect(dir)
    const apiScript = scripts.find((s) => s.name === 'run:api')
    const workerScript = scripts.find((s) => s.name === 'run:worker')

    expect(apiScript).toEqual({
      id: 'go:run:api',
      name: 'run:api',
      source: 'go',
      command: 'go run ./cmd/api',
      description: '运行 cmd/api (go run ./cmd/api)',
      ports: [9090],
      portsInferred: true
    })

    expect(workerScript).toEqual({
      id: 'go:run:worker',
      name: 'run:worker',
      source: 'go',
      command: 'go run ./cmd/worker',
      description: '运行 cmd/worker (go run ./cmd/worker)'
    })
  })
})
