import { describe, expect, it, vi } from 'vitest'
import { createIdentityReader, parseStartTime } from './process-identity'

describe('createIdentityReader on Windows', () => {
  it('reads start times of all pids with one PowerShell call', async () => {
    const execFile = vi.fn<(file: string, args: string[]) => Promise<{ stdout: string }>>(
      async () => ({ stdout: '1200 638640000000000000\r\n3400 638640000012345678\r\n' })
    )
    const read = createIdentityReader({ platform: 'win32', execFile })
    const identities = await read([1200, 3400, 5600])
    expect(identities).toEqual(
      new Map([
        [1200, '638640000000000000'],
        [3400, '638640000012345678']
      ])
    )
    expect(execFile).toHaveBeenCalledTimes(1)
    expect(execFile.mock.calls[0]?.[1]?.join(' ')).toContain('Get-Process -Id 1200,3400,5600')
  })

  it('skips the call for no pids and survives PowerShell failing', async () => {
    const execFile = vi.fn(async () => {
      throw new Error('powershell missing')
    })
    const read = createIdentityReader({ platform: 'win32', execFile })
    await expect(read([])).resolves.toEqual(new Map())
    expect(execFile).not.toHaveBeenCalled()
    await expect(read([1200])).resolves.toEqual(new Map())
  })
})

describe('createIdentityReader on Linux', () => {
  const stat = (pid: number, start: number) =>
    `${pid} (node) S 1 ${pid} ${pid} 0 -1 4194304 1 0 0 0 5 2 0 0 20 0 7 0 ${start} 1000 100`

  it('combines the boot id with each live process start time', async () => {
    const files: Record<string, string> = {
      '/proc/sys/kernel/random/boot_id': 'boot-123\n',
      '/proc/42/stat': stat(42, 987654)
    }
    const readFile = async (path: string) => {
      const content = files[path]
      if (content === undefined) throw new Error('ENOENT')
      return content
    }
    const identities = await createIdentityReader({ platform: 'linux', readFile })([42, 43])
    expect(identities).toEqual(new Map([[42, 'boot-123:987654']]))
  })
})

describe('parseStartTime', () => {
  it('reads field 22, even when the command name has spaces and parentheses', () => {
    expect(
      parseStartTime('7 (my (odd) app) S 1 7 7 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 5555 0 0')
    ).toBe('5555')
  })

  it('returns null for malformed lines', () => {
    expect(parseStartTime('garbage')).toBeNull()
  })
})

describe('createIdentityReader on this machine', () => {
  it('identifies a live process stably and finds nothing for an exited one', async () => {
    const read = createIdentityReader({ platform: process.platform })
    const { spawnSync } = await import('child_process')
    const exited = spawnSync(process.execPath, ['-e', '0']).pid

    const first = await read([process.pid, exited])
    const second = await read([process.pid])
    expect(first.get(process.pid)).toMatch(/\d/)
    expect(second.get(process.pid)).toBe(first.get(process.pid))
    expect(first.has(exited)).toBe(false)
  }, 20_000)
})
