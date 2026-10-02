import { describe, expect, it, vi } from 'vitest'
import { createProcessKiller } from './process-killer'
import type { PtyProcess } from './pty'

const fakePty = (pid: number) =>
  ({
    pid,
    onData: vi.fn<PtyProcess['onData']>(),
    onExit: vi.fn<PtyProcess['onExit']>(),
    write: vi.fn<PtyProcess['write']>(),
    resize: vi.fn<PtyProcess['resize']>()
  }) satisfies PtyProcess

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

describe('createProcessKiller on win32', () => {
  it('interrupts with Ctrl+C through the console', () => {
    const pty = fakePty(42)
    createProcessKiller({ platform: 'win32', execFile: vi.fn() }).interrupt(pty)
    expect(pty.write).toHaveBeenCalledWith('\x03')
  })

  it('force-kills the whole tree with taskkill', async () => {
    const execFile = vi.fn(async () => undefined)
    await createProcessKiller({ platform: 'win32', execFile }).forceKill(42)
    expect(execFile).toHaveBeenCalledWith('taskkill', ['/PID', '42', '/T', '/F'])
  })

  it('ignores taskkill failures for processes that already exited', async () => {
    const execFile = vi.fn(async () => {
      throw new Error('not found')
    })
    await expect(
      createProcessKiller({ platform: 'win32', execFile }).forceKill(42)
    ).resolves.toBeUndefined()
  })
})

describe('createProcessKiller on linux', () => {
  it('interrupts the process group with SIGTERM', () => {
    const kill = vi.fn()
    createProcessKiller({ platform: 'linux', kill }).interrupt(fakePty(42))
    expect(kill).toHaveBeenCalledWith(-42, 'SIGTERM')
  })

  it('force-kills the process group with SIGKILL', async () => {
    const kill = vi.fn()
    await createProcessKiller({ platform: 'linux', kill }).forceKill(42)
    expect(kill).toHaveBeenCalledWith(-42, 'SIGKILL')
  })

  it('ignores groups that are already gone', async () => {
    const kill = vi.fn(() => {
      throw errno('ESRCH')
    })
    const killer = createProcessKiller({ platform: 'linux', kill })
    expect(() => killer.interrupt(fakePty(42))).not.toThrow()
    await expect(killer.forceKill(42)).resolves.toBeUndefined()
  })

  it('rethrows other errors', () => {
    const kill = vi.fn(() => {
      throw errno('EPERM')
    })
    expect(() => createProcessKiller({ platform: 'linux', kill }).interrupt(fakePty(42))).toThrow(
      'EPERM'
    )
  })
})
