import { EventEmitter } from 'events'
import type { ChildProcess } from 'child_process'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import type { ElectronApplication, TestInfo } from '@playwright/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeRunningApps, trackAppDiagnostics } from '../../e2e/diagnostics'

vi.mock('fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }))
vi.mock('child_process', () => ({
  execFile: vi.fn(
    (
      _command: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => callback(null, 'process snapshot fixture', '')
  )
}))

function fixture(close: () => Promise<void>) {
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const app = {
    close,
    process: () => ({ pid: 1234, exitCode: null, signalCode: null, stdout, stderr })
  } as unknown as ElectronApplication
  const attachments: TestInfo['attachments'] = []
  const info = {
    attachments,
    outputPath: (name: string) => join('diagnostics', name)
  } as unknown as TestInfo
  trackAppDiagnostics(app, info, 0)
  return { app, attachments, stdout, stderr }
}

describe('Electron E2E close diagnostics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('saves logs and process evidence before a slow close finishes', async () => {
    let finish: () => void = () => undefined
    const { app, attachments, stdout, stderr } = fixture(
      () => new Promise<void>((resolve) => (finish = resolve))
    )
    stdout.emit('data', Buffer.from('normal output\n'))
    stderr.emit('data', Buffer.from('close warning\n'))
    const closing = app.close()
    await vi.advanceTimersByTimeAsync(9999)
    expect(attachments).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(attachments).toEqual([
      { name: 'electron-0', path: join('diagnostics', 'electron-0.log'), contentType: 'text/plain' }
    ])
    const contents = vi.mocked(writeFile).mock.calls.at(-1)?.[1]
    expect(contents).toContain('app.close pending for 10 seconds')
    expect(contents).toContain('"pid":1234')
    expect(contents).toContain('stdout: normal output')
    expect(contents).toContain('stderr: close warning')
    expect(contents).toContain('process snapshot fixture')
    finish()
    await closing
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the original close rejection and saves diagnostics', async () => {
    const failure = new Error('Electron close failed')
    const { app, attachments } = fixture(() => Promise.reject(failure))
    await expect(app.close()).rejects.toBe(failure)
    expect(attachments).toHaveLength(1)
    expect(vi.mocked(writeFile).mock.calls.at(-1)?.[1]).toContain('Electron close failed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels diagnostic collection when close finishes promptly', async () => {
    const { app, attachments } = fixture(() => Promise.resolve())
    await app.close()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(attachments).toEqual([])
    expect(writeFile).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips an exited application without accessing its destroyed Playwright object', async () => {
    const close = vi.fn(() => Promise.resolve())
    const child = { exitCode: 0, signalCode: null } as ChildProcess
    await closeRunningApps([{ app: { close }, child }])
    expect(close).not.toHaveBeenCalled()
  })

  it('cleans up remaining applications before reporting a close failure', async () => {
    const failure = new Error('first application failed to close')
    const first = vi.fn(() => Promise.reject(failure))
    const second = vi.fn(() => Promise.resolve())
    const child = { exitCode: null, signalCode: null } as ChildProcess
    await expect(
      closeRunningApps([
        { app: { close: first }, child },
        { app: { close: second }, child }
      ])
    ).rejects.toMatchObject({ errors: [failure] })
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })
})
