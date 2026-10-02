import { createServer, type Server } from 'net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describePortConflicts } from '@devhub/shared'
import { createPortGuard } from './port-guard'
import { createPortOwnerFinder, parseSsOwner, parseWindowsOwner } from './port-owner'

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

  it('finds this test process listening on a port', async () => {
    server = createServer()
    const port = await new Promise<number>((resolve) =>
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    )
    const owner = await createPortOwnerFinder({ platform: process.platform })(port)
    // `ss` may be missing on minimal Linux images; then the owner is simply unknown.
    if (owner) expect(owner.pid).toBe(process.pid)
  }, 20_000)
})
