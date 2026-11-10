import { spawn, type ChildProcess } from 'child_process'
import { once } from 'events'
import { createServer, type Server } from 'http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { checkLocalPort } from '../net/local-port'
import { createPortReleaser } from './port-releaser'
import { createPortProcessesReader } from './port-processes'

const listenerCode = `
const { createServer } = require('http')
const { spawn } = require('child_process')
const stubborn = process.argv[1] === 'stubborn'
if (stubborn) process.on('SIGTERM', () => {})
const child = spawn(process.execPath, ['-e',
  (stubborn ? "process.on('SIGTERM', () => {});" : '') +
  "process.send('ready'); setInterval(() => {}, 1000)"
], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
const server = createServer((request, response) => response.end('old listener'))
child.once('message', () => server.listen(0, '127.0.0.1', () => process.send({
  port: server.address().port, listenerPid: process.pid, childPid: child.pid
})))
process.on('message', () => {
  child.once('exit', () => server.close(() => process.exit(0)))
  child.kill('SIGTERM')
})
`

const managedCode = `
const { spawn } = require('child_process')
const child = spawn(process.execPath, ['-e', ${JSON.stringify(listenerCode)}, 'polite'], {
  stdio: ['ignore', 'ignore', 'ignore', 'ipc']
})
child.on('message', (message) => process.send(message))
child.on('exit', () => process.exit(0))
process.on('message', () => child.send('stop'))
`

const fixtureInfo = z.object({
  port: z.number().int().positive(),
  listenerPid: z.number().int().positive(),
  childPid: z.number().int().positive()
})

describe.runIf(process.platform === 'linux')('port releaser with real Linux processes', () => {
  const children: ChildProcess[] = []
  const ownedPids = new Set<number>()
  let replacement: Server | undefined
  const readProcesses = createPortProcessesReader({ platform: process.platform })

  const alive = async (pid: number) => (await readProcesses()).some((row) => row.pid === pid)
  const waitUntil = async (predicate: () => Promise<boolean>, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs
    while (!(await predicate())) {
      if (Date.now() >= deadline) throw new Error('fixture did not settle')
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }

  const start = async (code: string, mode = 'polite') => {
    const child = spawn(process.execPath, ['-e', code, mode], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    })
    children.push(child)
    if (child.pid) ownedPids.add(child.pid)
    const [message] = await once(child, 'message')
    const info = fixtureInfo.parse(message)
    ownedPids.add(info.listenerPid)
    ownedPids.add(info.childPid)
    expect(await (await fetch(`http://127.0.0.1:${info.port}`)).text()).toBe('old listener')
    return { child, ...info }
  }

  afterEach(async () => {
    if (replacement) {
      await new Promise<void>((resolve, reject) =>
        replacement!.close((error) => (error ? reject(error) : resolve()))
      )
      replacement = undefined
    }
    for (const pid of ownedPids) {
      if (await alive(pid)) process.kill(pid, 'SIGKILL')
    }
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) await once(child, 'exit')
    }
    children.length = 0
    ownedPids.clear()
  })

  it('releases a real listener and all its children, then serves the same port', async () => {
    const fixture = await start(listenerCode)
    const kill = vi.fn((pid: number, signal: NodeJS.Signals) => process.kill(pid, signal))
    await createPortReleaser({ platform: 'linux', graceMs: 200, kill })({
      ports: [fixture.port]
    })
    await waitUntil(async () => !(await alive(fixture.childPid)))
    expect(await alive(fixture.listenerPid)).toBe(false)
    expect(kill.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(kill.mock.calls.every(([pid]) => pid > 0)).toBe(true)
    expect(await checkLocalPort(fixture.port)).toBe(false)

    replacement = createServer((_request, response) => response.end('replacement ready'))
    await new Promise<void>((resolve) => replacement!.listen(fixture.port, '127.0.0.1', resolve))
    expect(await (await fetch(`http://127.0.0.1:${fixture.port}`)).text()).toBe('replacement ready')
  }, 20_000)

  it('escalates to SIGKILL when the listener and descendant ignore SIGTERM', async () => {
    const fixture = await start(listenerCode, 'stubborn')
    const kill = vi.fn((pid: number, signal: NodeJS.Signals) => process.kill(pid, signal))
    await createPortReleaser({ platform: 'linux', graceMs: 100, pollMs: 10, kill })({
      ports: [fixture.port]
    })
    expect(kill).toHaveBeenCalledWith(fixture.listenerPid, 'SIGTERM')
    expect(kill).toHaveBeenCalledWith(fixture.listenerPid, 'SIGKILL')
    expect(kill).toHaveBeenCalledWith(fixture.childPid, 'SIGKILL')
    expect(await checkLocalPort(fixture.port)).toBe(false)
    expect(await alive(fixture.listenerPid)).toBe(false)
    expect(await alive(fixture.childPid)).toBe(false)
  }, 20_000)

  it('maps a listening descendant to its managed root and awaits normal stop', async () => {
    const fixture = await start(managedCode)
    const kill = vi.fn((pid: number, signal: NodeJS.Signals) => process.kill(pid, signal))
    const stop = vi.fn(async () => {
      const exited = once(fixture.child, 'exit')
      fixture.child.send('stop')
      await exited
    })
    await createPortReleaser({ platform: 'linux', graceMs: 200, kill })(
      { ports: [fixture.port, fixture.port] },
      [{ pid: fixture.child.pid!, stop }]
    )
    expect(stop).toHaveBeenCalledTimes(1)
    expect(kill).not.toHaveBeenCalled()
    expect(await checkLocalPort(fixture.port)).toBe(false)
    expect(await alive(fixture.listenerPid)).toBe(false)
    expect(await alive(fixture.childPid)).toBe(false)
  }, 20_000)

  it('refuses to terminate its own real HTTP listener', async () => {
    replacement = createServer((_request, response) => response.end('protected listener'))
    await new Promise<void>((resolve) => replacement!.listen(0, '127.0.0.1', resolve))
    const address = replacement.address()
    if (!address || typeof address === 'string') throw new Error('missing fixture port')
    await expect(
      createPortReleaser({ platform: 'linux' })({ ports: [address.port] })
    ).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: expect.stringContaining('受保护')
    })
    expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe(
      'protected listener'
    )
  }, 20_000)
})
