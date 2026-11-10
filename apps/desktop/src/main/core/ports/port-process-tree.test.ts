import { describe, expect, it, vi } from 'vitest'
import { createPortProcessTerminator, type PortProcessTreeDeps } from './port-process-tree'
import type { PortExecFile, PortProcess } from './port-processes'

const root: PortProcess = { pid: 200, parentPid: 0, identity: '200-start' }
const child: PortProcess = { pid: 201, parentPid: 200, identity: '201-start' }
const self: PortProcess = { pid: 900, parentPid: 100, identity: '900-start' }
const ancestor: PortProcess = { pid: 100, parentPid: 0, identity: null }

function harness(platform: 'linux' | 'win32', initial: PortProcess[] = [root, child]) {
  let processes = [self, ancestor, ...initial]
  const readProcesses = vi.fn(async () => processes.map((row) => ({ ...row })))
  const kill = vi.fn<NonNullable<PortProcessTreeDeps['kill']>>()
  const exec = vi.fn<PortExecFile>(async () => ({ stdout: '' }))
  return {
    readProcesses,
    kill,
    exec,
    remove(pid: number) {
      processes = processes.filter((row) => row.pid !== pid)
    },
    replace(row: PortProcess) {
      processes = processes.map((current) => (current.pid === row.pid ? row : current))
    },
    make(overrides: Partial<PortProcessTreeDeps> = {}) {
      return createPortProcessTerminator({
        platform,
        readProcesses,
        graceMs: 0,
        forceTimeoutMs: 0,
        pollMs: 1,
        selfPid: 900,
        kill,
        execFile: exec,
        ...overrides
      })
    }
  }
}

describe('Linux external process trees', () => {
  it('stops descendants before roots using positive PIDs and TERM only when they exit', async () => {
    const state = harness('linux')
    state.kill.mockImplementation((pid) => state.remove(pid))
    await state.make()([root])
    expect(state.kill.mock.calls).toEqual([
      [201, 'SIGTERM'],
      [200, 'SIGTERM']
    ])
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('escalates surviving descendants and roots to KILL without guessing process group IDs', async () => {
    const state = harness('linux')
    state.kill.mockImplementation((pid, signal) => {
      if (signal === 'SIGKILL') state.remove(pid)
    })
    await state.make()([root])
    expect(state.kill.mock.calls).toEqual([
      [201, 'SIGTERM'],
      [200, 'SIGTERM'],
      [201, 'SIGKILL'],
      [200, 'SIGKILL']
    ])
    expect(state.kill.mock.calls.every(([pid]) => pid > 0)).toBe(true)
  })

  it('keeps descendants first when several unrelated roots have interleaving PIDs', async () => {
    const other: PortProcess = { pid: 201, parentPid: 0, identity: 'other-start' }
    const branch: PortProcess = { pid: 202, parentPid: 200, identity: 'branch-start' }
    const leaf: PortProcess = { pid: 203, parentPid: 202, identity: 'leaf-start' }
    const state = harness('linux', [root, other, branch, leaf])
    state.kill.mockImplementation((pid) => state.remove(pid))
    await state.make()([root, other])
    expect(state.kill.mock.calls).toEqual([
      [203, 'SIGTERM'],
      [202, 'SIGTERM'],
      [200, 'SIGTERM'],
      [201, 'SIGTERM']
    ])
  })

  it('waits for graceful exit before choosing whether to force-kill', async () => {
    const state = harness('linux', [root])
    state.kill.mockImplementation((pid) => {
      setTimeout(() => state.remove(pid), 5)
    })
    await state.make({ graceMs: 100 })([root])
    expect(state.kill.mock.calls).toEqual([[200, 'SIGTERM']])
  })

  it('tracks new grandchildren of an orphaned child after the original root exits', async () => {
    const grandchild: PortProcess = { pid: 202, parentPid: 201, identity: '202-start' }
    let processes = [self, ancestor, root, child]
    let spawned = false
    let birth: ReturnType<typeof setTimeout> | undefined
    const kill = vi.fn<NonNullable<PortProcessTreeDeps['kill']>>((pid, signal) => {
      if (pid === root.pid && signal === 'SIGTERM') {
        processes = [self, ancestor, { ...child, parentPid: 0 }]
        birth = setTimeout(() => {
          spawned = true
          processes.push(grandchild)
        }, 5)
      }
      if (signal === 'SIGKILL') processes = processes.filter((row) => row.pid !== pid)
    })
    const terminate = createPortProcessTerminator({
      platform: 'linux',
      readProcesses: async () => processes.map((row) => ({ ...row })),
      graceMs: 30,
      forceTimeoutMs: 10,
      pollMs: 1,
      selfPid: 900,
      kill
    })
    try {
      await terminate([root])
      expect(spawned).toBe(true)
      expect(kill.mock.calls).toEqual([
        [201, 'SIGTERM'],
        [200, 'SIGTERM'],
        [202, 'SIGKILL'],
        [201, 'SIGKILL']
      ])
      expect(processes).toEqual([self, ancestor])
    } finally {
      clearTimeout(birth)
    }
  })

  it('propagates permission failures and does not attempt another signal', async () => {
    const state = harness('linux')
    const failure = Object.assign(new Error('permission denied'), { code: 'EPERM' })
    state.kill.mockImplementation(() => {
      throw failure
    })
    await expect(state.make()([root])).rejects.toBe(failure)
    expect(state.kill.mock.calls).toEqual([[201, 'SIGTERM']])
  })

  it('tolerates a process exiting between identity verification and signalling', async () => {
    const state = harness('linux')
    state.kill.mockImplementation((pid) => {
      state.remove(pid)
      throw Object.assign(new Error('already exited'), { code: 'ESRCH' })
    })
    await expect(state.make()([root])).resolves.toBeUndefined()
    expect(state.kill.mock.calls).toEqual([
      [201, 'SIGTERM'],
      [200, 'SIGTERM']
    ])
  })

  it('reports a tree that remains alive after forced termination', async () => {
    const state = harness('linux', [root])
    await expect(state.make()([root])).rejects.toThrow('进程树未能退出：200')
    expect(state.kill.mock.calls).toEqual([
      [200, 'SIGTERM'],
      [200, 'SIGKILL']
    ])
  })
})

describe('Windows external process trees', () => {
  it('protects the Windows System process before issuing taskkill', async () => {
    const system: PortProcess = { pid: 4, parentPid: 0, identity: 'system-start' }
    const state = harness('win32', [system])
    await expect(state.make()([system])).rejects.toThrow('拒绝结束受保护进程 PID 4')
    expect(state.exec).not.toHaveBeenCalled()
    expect(state.kill).not.toHaveBeenCalled()
  })

  it('uses taskkill /T once for nested roots and avoids /F when the tree exits', async () => {
    const state = harness('win32')
    state.exec.mockImplementation(async () => {
      state.remove(200)
      state.remove(201)
      return { stdout: '' }
    })
    await state.make()([root, child])
    expect(state.exec.mock.calls).toEqual([['taskkill', ['/PID', '200', '/T']]])
    expect(state.kill).not.toHaveBeenCalled()
  })

  it('allows console rejection of /T then force-kills surviving descendants before roots', async () => {
    const state = harness('win32')
    state.exec.mockImplementation(async (_file, args) => {
      if (!args.includes('/F')) throw new Error('console application requires /F')
      state.remove(Number(args[1]))
      return { stdout: '' }
    })
    await state.make()([root])
    expect(state.exec.mock.calls).toEqual([
      ['taskkill', ['/PID', '200', '/T']],
      ['taskkill', ['/PID', '201', '/T', '/F']],
      ['taskkill', ['/PID', '200', '/T', '/F']]
    ])
  })

  it('propagates a forced termination failure when the verified process remains alive', async () => {
    const state = harness('win32', [root])
    const failure = new Error('access denied')
    state.exec.mockRejectedValue(failure)
    await expect(state.make()([root])).rejects.toBe(failure)
    expect(state.exec.mock.calls).toEqual([
      ['taskkill', ['/PID', '200', '/T']],
      ['taskkill', ['/PID', '200', '/T', '/F']]
    ])
  })

  it('accepts taskkill failure when a fresh snapshot confirms the process already exited', async () => {
    const state = harness('win32', [root])
    state.exec.mockImplementation(async () => {
      state.remove(200)
      throw new Error('process not found')
    })
    await expect(state.make()([root])).resolves.toBeUndefined()
    expect(state.exec.mock.calls).toEqual([['taskkill', ['/PID', '200', '/T']]])
  })
})

describe.each(['linux', 'win32'] as const)('%s process identity and protection', (platform) => {
  it('does not inspect processes when there is no external root to terminate', async () => {
    const state = harness(platform)
    await expect(state.make()([])).resolves.toBeUndefined()
    expect(state.readProcesses).not.toHaveBeenCalled()
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('rejects a root PID reused before initial enumeration', async () => {
    const state = harness(platform, [{ ...root, identity: 'new-process' }])
    await expect(state.make()([root])).rejects.toThrow('身份已变化')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('rechecks identity immediately before attempting termination', async () => {
    const state = harness(platform, [root])
    let reads = 0
    const terminate = state.make({
      readProcesses: async () => {
        reads++
        return [self, ancestor, reads === 1 ? root : { ...root, identity: 'new-process' }]
      }
    })
    await expect(terminate([root])).rejects.toThrow('身份已变化')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('rejects a root PID reused while waiting for the original tree to exit', async () => {
    const state = harness(platform, [root])
    const replaceRoot = (): void => state.replace({ ...root, identity: 'new-process' })
    state.kill.mockImplementation(replaceRoot)
    state.exec.mockImplementation(async () => {
      replaceRoot()
      return { stdout: '' }
    })
    await expect(state.make()([root])).rejects.toThrow('身份已变化')
    expect(state.kill.mock.calls.every(([, signal]) => signal !== 'SIGKILL')).toBe(true)
    expect(state.exec.mock.calls.every(([, args]) => !args.includes('/F'))).toBe(true)
  })

  it('rejects a target whose creation identity is withheld', async () => {
    const hidden = { ...root, identity: null }
    const state = harness(platform, [hidden])
    await expect(state.make()([hidden])).rejects.toThrow('无法核验进程 PID 200 的启动身份')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('rejects a descendant whose creation identity is withheld before touching its tree', async () => {
    const state = harness(platform, [root, { ...child, identity: null }])
    await expect(state.make()([root])).rejects.toThrow('无法核验进程 PID 201 的启动身份')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('allows unrelated processes and ancestors whose creation identities are withheld', async () => {
    const state = harness(platform, [root, { pid: 42, parentPid: 0, identity: null }])
    state.kill.mockImplementation((pid) => state.remove(pid))
    state.exec.mockImplementation(async () => {
      state.remove(200)
      return { stdout: '' }
    })
    await expect(state.make()([root])).resolves.toBeUndefined()
  })

  it.each([
    ['self', self],
    ['ancestor', { ...ancestor, identity: '100-start' }],
    ['PID 1', { pid: 1, parentPid: 0, identity: '1-start' }]
  ])('protects %s before issuing any command', async (_name, protectedRoot) => {
    const state = harness(platform, [protectedRoot])
    await expect(state.make()([protectedRoot])).rejects.toThrow('拒绝结束受保护进程')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('rejects missing ancestry information before issuing any command', async () => {
    const state = harness(platform, [root])
    const terminate = state.make({ readProcesses: async () => [self, root] })
    await expect(terminate([root])).rejects.toThrow('无法核验应用的祖先进程 PID 100')
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })

  it('propagates a failed snapshot without attempting termination', async () => {
    const state = harness(platform)
    const failure = new Error('cannot inspect process tree')
    const terminate = state.make({
      readProcesses: async () => {
        throw failure
      }
    })
    await expect(terminate([root])).rejects.toBe(failure)
    expect(state.kill).not.toHaveBeenCalled()
    expect(state.exec).not.toHaveBeenCalled()
  })
})
