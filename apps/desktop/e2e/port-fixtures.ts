import { spawn, type ChildProcess } from 'child_process'
import { once } from 'events'
import { createServer } from 'net'
import { z } from 'zod'
import { test as base } from './fixtures'

export { expect } from './fixtures'

export interface HttpListener {
  child: ChildProcess
  port: number
  pid: number
  stop(): Promise<void>
}

/** A real listener in an owned subprocess; termination never targets the test runner. */
async function startListener(body: string): Promise<HttpListener> {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `require('http').createServer((_, res) => res.end(${JSON.stringify(body)}))
        .listen(0, '127.0.0.1', function () {
          process.send({ port: this.address().port, pid: process.pid })
        })`
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }
  )
  let stderr = ''
  child.stderr?.on('data', (data: Buffer) => (stderr += data.toString()))
  const ready = Promise.race([
    once(child, 'message').then((messages) => {
      const message: unknown = messages[0]
      return message
    }),
    once(child, 'exit').then(() => {
      throw new Error(`HTTP listener exited before opening its port: ${stderr}`)
    })
  ])
  const { port, pid } = z
    .object({ port: z.number().int().positive(), pid: z.number() })
    .parse(await ready)
  return {
    child,
    port,
    pid,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
  }
}

export const test = base.extend<{
  listener: (body: string) => Promise<HttpListener>
}>({
  listener: async ({}, use) => {
    const listeners: HttpListener[] = []
    await use(async (body) => {
      const listener = await startListener(body)
      listeners.push(listener)
      return listener
    })
    await Promise.all(listeners.map((listener) => listener.stop()))
  }
})

/** A fixture server run through the same npm/shell/PTY chain as a user's script. */
export const httpServerScript = `
const { values } = require('util').parseArgs({
  options: { port: { type: 'string' }, body: { type: 'string' } }
})
require('http').createServer((_, res) => res.end(values.body))
  .listen(Number(values.port), '127.0.0.1', () => console.log('HTTP ready'))
`

export const hasExited = ({ child }: HttpListener): boolean =>
  child.exitCode !== null || child.signalCode !== null

export async function httpBody(port: number): Promise<string | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { Connection: 'close' },
      signal: AbortSignal.timeout(1000)
    })
    return response.ok ? await response.text() : null
  } catch {
    return null
  }
}

/** Successfully rebinding the exact port proves the stopped process released it. */
export const canBind = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
