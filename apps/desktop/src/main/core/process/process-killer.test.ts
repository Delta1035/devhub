import { describe, expect, it, vi } from 'vitest'
import { createProcessKiller, parseSessionId } from './process-killer'
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

  it('hangs up a shell by killing its tree right away (Ctrl+C would not end it)', async () => {
    const execFile = vi.fn(async () => undefined)
    const pty = fakePty(42)
    await createProcessKiller({ platform: 'win32', execFile }).hangup(pty)
    expect(execFile).toHaveBeenCalledWith('taskkill', ['/PID', '42', '/T', '/F'])
    expect(pty.write).not.toHaveBeenCalled()
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

  it('hangs up a shell with SIGHUP', async () => {
    const kill = vi.fn()
    await createProcessKiller({ platform: 'linux', kill }).hangup(fakePty(42))
    expect(kill).toHaveBeenCalledWith(-42, 'SIGHUP')
  })

  it('force-kills the process group and every process in the session', async () => {
    const kill = vi.fn()
    // An interactive shell's jobs live in their own groups (here 50 and 51) but same session.
    const listSession = vi.fn(async () => [42, 50, 51])
    await createProcessKiller({ platform: 'linux', kill, listSession }).forceKill(42)
    expect(listSession).toHaveBeenCalledWith(42)
    expect(kill.mock.calls).toEqual([
      [-42, 'SIGKILL'],
      [42, 'SIGKILL'],
      [50, 'SIGKILL'],
      [51, 'SIGKILL']
    ])
  })

  it('still kills the group when the session cannot be listed', async () => {
    const kill = vi.fn()
    const listSession = vi.fn(async () => {
      throw new Error('no /proc')
    })
    await createProcessKiller({ platform: 'linux', kill, listSession }).forceKill(42)
    expect(kill).toHaveBeenCalledWith(-42, 'SIGKILL')
  })

  it('ignores groups that are already gone', async () => {
    const kill = vi.fn(() => {
      throw errno('ESRCH')
    })
    const killer = createProcessKiller({ platform: 'linux', kill, listSession: async () => [] })
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

describe('parseSessionId', () => {
  it('reads the session id from a /proc stat line', () => {
    expect(parseSessionId('1234 (node) S 1200 1234 1100 34816 1234 4194304 0')).toBe(1100)
  })

  it('handles command names with spaces and parentheses', () => {
    expect(parseSessionId('77 (my (weird) app) R 1 77 60 0 -1')).toBe(60)
  })

  it('returns null for malformed lines', () => {
    expect(parseSessionId('garbage')).toBeNull()
  })
})
