import { createServer, type Server } from 'net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describePortConflicts } from '@devhub/shared'
import { createPortGuard } from './port-guard'
import {
  createPortOwnerFinder,
  createPortOwnersFinder,
  parseSsOwner,
  parseSsOwners,
  parseWindowsOwner,
  parseWindowsOwners,
  type PortOwnerDeps
} from './port-owner'

describe('parseWindowsOwner', () => {
  it.each([
    ['1234 node\r\n', { pid: 1234, name: 'node.exe' }],
    ['4 System', { pid: 4, name: 'System' }],
    ['5678', { pid: 5678, name: '未知进程' }],
    ['', null]
  ])('%j', (stdout, expected) => {
    expect(parseWindowsOwner(stdout)).toEqual(expected)
  })
})

describe('parseSsOwner', () => {
  it('reads the process from ss output', () => {
    expect(parseSsOwner('LISTEN 0 511 *:5173 *:* users:(("node",pid=1234,fd=23))\n')).toEqual({
      pid: 1234,
      name: 'node'
    })
  })

  it('returns null when ss hides the process (another user)', () => {
    expect(parseSsOwner('LISTEN 0 4096 127.0.0.53%lo:53 0.0.0.0:*\n')).toBeNull()
  })
})

describe('createPortOwnerFinder', () => {
  it('passes only a validated port to the OS tools', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    const find = createPortOwnerFinder({ platform: 'linux', execFile: exec })
    await expect(find(70000)).resolves.toBeNull()
    expect(exec).not.toHaveBeenCalled()
    await find(8080)
    expect(exec).toHaveBeenCalledWith('ss', ['-ltnpH', 'sport = :8080'])
  })

  it('returns null when the tool fails', async () => {
    const find = createPortOwnerFinder({
      platform: 'win32',
      execFile: async () => {
        throw new Error('no powershell')
      }
    })
    await expect(find(8080)).resolves.toBeNull()
  })
})

describe('parseSsOwners', () => {
  it('reads all socket sharers and listeners, deduplicating their PIDs', () => {
    expect(
      parseSsOwners(
        'LISTEN 0 511 0.0.0.0:8080 0.0.0.0:* users:(("node",pid=1234,fd=23),("worker",pid=5678,fd=24))\n' +
          'LISTEN 0 511 [::]:8080 [::]:* users:(("node",pid=1234,fd=25))\n' +
          'LISTEN 0 511 127.0.0.2:8080 0.0.0.0:* users:(("other-user",pid=9876,fd=3))\n'
      )
    ).toEqual([
      { pid: 1234, name: 'node' },
      { pid: 5678, name: 'worker' },
      { pid: 9876, name: 'other-user' }
    ])
  })

  it('returns an empty list when there are no listeners', () => {
    expect(parseSsOwners('\n')).toEqual([])
  })

  it.each([
    'LISTEN 0 511 *:8080 *:*\n',
    'LISTEN 0 511 *:8080 *:* users:(("hidden",fd=24))\n',
    'LISTEN 0 511 *:8080 *:* users:(("node",pid=1234,fd=23),("hidden",fd=24))\n',
    'LISTEN 0 511 *:8080 *:* users:(("node",pid=1234,fd=23))\nLISTEN 0 511 [::]:8080 [::]:*\n',
    'LISTEN 0 511 *:8080 *:* users:(("node",pid=0,fd=23))\n',
    'LISTEN 0 511 *:8080 *:* users:(("node",pid=99999999999999999,fd=23))\n',
    'not ss output'
  ])('rejects incomplete or invalid ownership: %j', (stdout) => {
    expect(() => parseSsOwners(stdout)).toThrow()
  })
})

describe('parseWindowsOwners', () => {
  it('validates every owner and deduplicates PIDs from IPv4 and IPv6 listeners', () => {
    expect(
      parseWindowsOwners(
        JSON.stringify([
          { pid: 1234, name: 'node' },
          { pid: 4, name: 'System' },
          { pid: 1234, name: 'node' },
          { pid: 5678, name: 'Another App' }
        ])
      )
    ).toEqual([
      { pid: 1234, name: 'node.exe' },
      { pid: 4, name: 'System' },
      { pid: 5678, name: 'Another App.exe' }
    ])
    expect(parseWindowsOwners('[]\r\n')).toEqual([])
  })

  it.each([
    '',
    'null',
    '{"pid":1234,"name":"node"}',
    '[{"pid":1234,"name":"node"},{"pid":5678,"name":null}]',
    '[{"pid":"1234","name":"node"}]',
    '[{"pid":0,"name":"System"}]',
    '[{"pid":2147483648,"name":"node"}]',
    '[{"pid":1234,"name":""}]'
  ])('rejects malformed or partial results: %j', (stdout) => {
    expect(() => parseWindowsOwners(stdout)).toThrow()
  })
})

describe('createPortOwnersFinder', () => {
  it.each(['linux', 'win32'] as const)(
    'rejects invalid ports before invoking %s tools',
    async (platform) => {
      const exec = vi.fn(async () => ({ stdout: '' }))
      const find = createPortOwnersFinder({ platform, execFile: exec })
      for (const port of [0, -1, 65536, 8080.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expect(find(port)).rejects.toThrow()
      }
      expect(exec).not.toHaveBeenCalled()
    }
  )

  it('queries all Linux listeners with the validated port', async () => {
    const exec = vi.fn(async () => ({ stdout: '' }))
    const find = createPortOwnersFinder({ platform: 'linux', execFile: exec })
    await expect(find(8080)).resolves.toEqual([])
    expect(exec).toHaveBeenCalledWith('ss', ['-ltnpH', 'sport = :8080'])
  })

  it('queries every Windows listener and fails on process lookup errors', async () => {
    const exec = vi.fn<NonNullable<PortOwnerDeps['execFile']>>(async () => ({
      stdout: '[{"pid":1234,"name":"node"},{"pid":5678,"name":"worker"}]'
    }))
    const find = createPortOwnersFinder({ platform: 'win32', execFile: exec })
    await expect(find(8080)).resolves.toEqual([
      { pid: 1234, name: 'node.exe' },
      { pid: 5678, name: 'worker.exe' }
    ])
    expect(exec).toHaveBeenCalledOnce()
    const call = exec.mock.calls[0]
    expect(call?.[0]).toBe('powershell.exe')
    expect(call?.[1].slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command'])
    const script = call?.[1][3]
    expect(script).toContain('Get-NetTCPConnection -ErrorAction Stop')
    expect(script).toContain("$_.State -eq 'Listen' -and $_.LocalPort -eq 8080")
    expect(script).toContain('Get-Process -Id $_.OwningProcess -ErrorAction Stop')
    expect(script).toContain('ConvertTo-Json -InputObject $owners')
    expect(script).not.toMatch(/Select-Object|SilentlyContinue/)
  })

  it.each(['linux', 'win32'] as const)('propagates %s tool failures', async (platform) => {
    const failure = new Error('access denied')
    const find = createPortOwnersFinder({
      platform,
      execFile: async () => {
        throw failure
      }
    })
    await expect(find(8080)).rejects.toBe(failure)
  })

  it('does not accept a known owner when another Linux listener is hidden', async () => {
    const find = createPortOwnersFinder({
      platform: 'linux',
      execFile: async () => ({
        stdout:
          'LISTEN 0 511 127.0.0.1:8080 0.0.0.0:* users:(("node",pid=1234,fd=23))\n' +
          'LISTEN 0 511 127.0.0.2:8080 0.0.0.0:*\n'
      })
    })
    await expect(find(8080)).rejects.toThrow('无法确认端口的全部监听进程')
  })
})

describe('port guard', () => {
  it('reports only taken ports, with their holder when known', async () => {
    const guard = createPortGuard({
      isPortInUse: async (port) => port !== 3000,
      findOwner: async (port) => (port === 5173 ? { pid: 42, name: 'node.exe' } : null)
    })
    const conflicts = await guard({ ports: [5173, 3000, 8080] })
    expect(conflicts).toEqual([
      { port: 5173, pid: 42, processName: 'node.exe' },
      { port: 8080, pid: null, processName: null }
    ])
    expect(describePortConflicts(conflicts)).toBe(
      '端口 5173 已被 node.exe（PID 42）占用；端口 8080 已被占用'
    )
    await expect(guard({})).resolves.toEqual([])
  })
})

describe('createPortOwnerFinder on this machine', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
  })

  it('finds this test process through the real OS tool, then confirms the port is released', async () => {
    const listener = createServer()
    server = listener
    const port = await new Promise<number>((resolve, reject) => {
      listener.once('error', reject)
      listener.listen(0, '127.0.0.1', () => {
        const address = listener.address()
        if (typeof address === 'object' && address) resolve(address.port)
        else reject(new Error('Expected a TCP address'))
      })
    })
    const findOwners = createPortOwnersFinder({ platform: process.platform })
    expect((await findOwners(port)).map(({ pid }) => pid)).toEqual([process.pid])
    expect(await createPortOwnerFinder({ platform: process.platform })(port)).toMatchObject({
      pid: process.pid
    })
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve()))
    )
    server = undefined
    await expect(findOwners(port)).resolves.toEqual([])
  }, 20_000)
})
