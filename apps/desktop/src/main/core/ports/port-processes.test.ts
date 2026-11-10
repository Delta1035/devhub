import { describe, expect, it, vi } from 'vitest'
import {
  createPortProcessesReader,
  hasAncestor,
  parsePortProcessStat,
  protectedPortPids,
  type PortExecFile,
  type PortProcess
} from './port-processes'

function processStat(pid: number, parentPid: number, identity = '123', state = 'S'): string {
  return `${pid} (worker (child)) ${[state, String(parentPid), ...Array<string>(17).fill('0'), identity].join(' ')}`
}

describe('createPortProcessesReader on Windows', () => {
  it('reads every process and requests a stable creation identity through PowerShell', async () => {
    const rows: PortProcess[] = [
      { pid: 900, parentPid: 100, identity: '638000000000000001' },
      { pid: 100, parentPid: 0, identity: '638000000000000000' },
      { pid: 42, parentPid: 100, identity: null }
    ]
    const exec = vi.fn<PortExecFile>(async () => ({ stdout: JSON.stringify(rows) }))
    const read = createPortProcessesReader({ platform: 'win32', execFile: exec })
    await expect(read()).resolves.toEqual(rows)
    expect(exec).toHaveBeenCalledOnce()
    const call = exec.mock.calls[0]
    expect(call?.[0]).toBe('powershell.exe')
    expect(call?.[1].slice(0, 3)).toEqual(['-NoProfile', '-NonInteractive', '-Command'])
    expect(call?.[1][3]).toContain('Get-CimInstance Win32_Process')
    expect(call?.[1][3]).toContain('$_.ProcessId -gt 0')
    expect(call?.[1][3]).toContain('CreationDate.ToUniversalTime().Ticks.ToString()')
    expect(call?.[1][3]).toContain('ConvertTo-Json -InputObject $rows')
  })

  it('accepts an empty process list without fabricating a process', async () => {
    const read = createPortProcessesReader({
      platform: 'win32',
      execFile: async () => ({ stdout: '[]\r\n' })
    })
    await expect(read()).resolves.toEqual([])
  })

  it.each([
    '',
    'null',
    '{}',
    '[{"pid":"42","parentPid":0,"identity":"123"}]',
    '[{"pid":0,"parentPid":0,"identity":"123"}]',
    '[{"pid":42.5,"parentPid":0,"identity":"123"}]',
    '[{"pid":42,"parentPid":-1,"identity":"123"}]',
    '[{"pid":42,"parentPid":"1","identity":"123"}]',
    '[{"pid":42,"parentPid":0,"identity":"invalid"}]',
    '[{"pid":42,"parentPid":0,"identity":123}]',
    '[{"pid":42,"parentPid":0}]'
  ])('rejects invalid process snapshots: %j', async (stdout) => {
    const read = createPortProcessesReader({
      platform: 'win32',
      execFile: async () => ({ stdout })
    })
    await expect(read()).rejects.toThrow()
  })

  it('propagates process enumeration errors', async () => {
    const failure = new Error('CIM access denied')
    const read = createPortProcessesReader({
      platform: 'win32',
      execFile: async () => {
        throw failure
      }
    })
    await expect(read()).rejects.toBe(failure)
  })
})

describe('createPortProcessesReader on Linux', () => {
  it('uses boot identity and start time while ignoring exited processes and non-PID entries', async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path === '/proc/sys/kernel/random/boot_id') return 'boot-id\n'
      if (path === '/proc/900/stat') return processStat(900, 100, '901')
      if (path === '/proc/100/stat') return processStat(100, 0, '101')
      if (path === '/proc/42/stat') throw Object.assign(new Error('gone'), { code: 'ENOENT' })
      if (path === '/proc/43/stat') throw Object.assign(new Error('gone'), { code: 'ESRCH' })
      if (path === '/proc/44/stat') return processStat(44, 100, '441', 'Z')
      if (path === '/proc/45/stat') return processStat(45, 100, '451', 'X')
      throw new Error(`Unexpected path: ${path}`)
    })
    const readdir = vi.fn(async (path: string) => {
      expect(path).toBe('/proc')
      return ['900', '100', '42', '43', '44', '45', '0', '00', 'self', 'net']
    })
    const read = createPortProcessesReader({ platform: 'linux', readFile, readdir })
    await expect(read()).resolves.toEqual([
      { pid: 900, parentPid: 100, identity: 'boot-id:901' },
      { pid: 100, parentPid: 0, identity: 'boot-id:101' }
    ])
    expect(readFile).toHaveBeenCalledTimes(7)
  })

  it('propagates permission failures instead of returning an incomplete tree', async () => {
    const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    const read = createPortProcessesReader({
      platform: 'linux',
      readdir: async () => ['42'],
      readFile: async (path) => {
        if (path.endsWith('boot_id')) return 'boot-id'
        throw failure
      }
    })
    await expect(read()).rejects.toBe(failure)
  })

  it('rejects an empty boot identity before enumerating processes', async () => {
    const readdir = vi.fn(async () => ['42'])
    const read = createPortProcessesReader({
      platform: 'linux',
      readFile: async () => '\n',
      readdir
    })
    await expect(read()).rejects.toThrow('无法读取系统启动标识')
    expect(readdir).not.toHaveBeenCalled()
  })

  it('propagates a failed process directory scan', async () => {
    const failure = new Error('cannot read /proc')
    const read = createPortProcessesReader({
      platform: 'linux',
      readFile: async () => 'boot-id',
      readdir: async () => {
        throw failure
      }
    })
    await expect(read()).rejects.toBe(failure)
  })

  it('rejects unsupported platforms without reading Linux files', async () => {
    const readFile = vi.fn(async () => '')
    const read = createPortProcessesReader({ platform: 'darwin', readFile })
    await expect(read()).rejects.toThrow('不支持自动释放端口的平台：darwin')
    expect(readFile).not.toHaveBeenCalled()
  })
})

describe('parsePortProcessStat', () => {
  it('handles spaces and parentheses in process names without shifting fields', () => {
    expect(parsePortProcessStat(processStat(42, 100, '987654321'), 'boot')).toEqual({
      pid: 42,
      parentPid: 100,
      identity: 'boot:987654321'
    })
  })

  it.each([
    '',
    processStat(0, 100),
    processStat(42, -1),
    processStat(42, 100, 'invalid'),
    processStat(42, 100, '123', '??')
  ])('rejects invalid proc stat: %j', (stat) => {
    expect(() => parsePortProcessStat(stat, 'boot')).toThrow('无法识别的进程信息')
  })
})

describe('process ancestry protection', () => {
  const processes = new Map<number, PortProcess>([
    [900, { pid: 900, parentPid: 100, identity: '900' }],
    [100, { pid: 100, parentPid: 0, identity: null }],
    [42, { pid: 42, parentPid: 100, identity: '42' }]
  ])

  it('finds inclusive ancestry without including an unrelated branch', () => {
    expect(hasAncestor(900, 900, processes)).toBe(true)
    expect(hasAncestor(900, 100, processes)).toBe(true)
    expect(hasAncestor(900, 42, processes)).toBe(false)
    expect(hasAncestor(1234, 100, processes)).toBe(false)
  })

  it('terminates safely when parent data contains a cycle', () => {
    const cyclic = new Map(processes)
    cyclic.set(100, { pid: 100, parentPid: 900, identity: '100' })
    expect(hasAncestor(900, 42, cyclic)).toBe(false)
  })

  it('protects Linux self, ancestors and PID 1 even when an ancestor identity is hidden', () => {
    expect([...protectedPortPids(900, processes, 'linux')].sort((a, b) => a - b)).toEqual([
      0, 1, 100, 900
    ])
  })

  it('also protects Windows system PIDs', () => {
    expect([...protectedPortPids(900, processes, 'win32')].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 100, 900
    ])
  })

  it('refuses to guess missing Linux ancestor relationships', () => {
    const incomplete = new Map(processes)
    incomplete.delete(100)
    expect(() => protectedPortPids(900, incomplete, 'linux')).toThrow(
      '无法核验应用的祖先进程 PID 100'
    )
  })

  it('stops at a missing Windows parent while protecting the stale PID', () => {
    const incomplete = new Map(processes)
    incomplete.delete(100)
    expect([...protectedPortPids(900, incomplete, 'win32')].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 100, 900
    ])
  })
})
