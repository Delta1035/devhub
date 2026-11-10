import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevhubError, type Run, type Script } from '@devhub/shared'
import { createHarness, project, type TestHarness } from './run-manager.fixtures'
import type { RunManagerDeps } from './run-manager'

function updatedStates(harness: TestHarness, run: Run): { status: string; stopped: boolean }[] {
  return harness.events.flatMap((event) =>
    event.type === 'run-updated' && event.run.id === run.id
      ? [{ status: event.run.status, stopped: event.run.stopped }]
      : []
  )
}

describe('RunManager stop failures', () => {
  let harness: TestHarness

  beforeEach(() => {
    vi.useFakeTimers()
    harness = createHarness()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects every concurrent stop after interrupt EPERM, restores running state and allows retry', async () => {
    const failure = Object.assign(new Error('cannot interrupt'), { code: 'EPERM' })
    harness.killer.interrupt.mockImplementationOnce(() => {
      throw failure
    })
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopped = Promise.allSettled([manager.stop(run.id), manager.stop(run.id)])
    await expect(stopped).resolves.toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure }
    ])
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(1)
    expect(harness.killer.forceKill).not.toHaveBeenCalled()
    expect(manager.list()).toEqual([run])
    expect(updatedStates(harness, run)).toEqual([
      { status: 'running', stopped: false },
      { status: 'stopping', stopped: true },
      { status: 'running', stopped: false }
    ])

    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(130)
    })
    await Promise.all([manager.stop(run.id), manager.stop(run.id)])
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(2)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: run.id, status: 'exited', stopped: true, exitCode: 130 })
    ])
  })

  it('rejects concurrent shell stops after a failed hangup and permits another hangup attempt', async () => {
    const failure = new Error('cannot hang up shell')
    harness.killer.hangup.mockRejectedValueOnce(failure)
    const manager = harness.makeManager()
    const run = await manager.startShell('p1', 'bash')
    const stopped = Promise.allSettled([manager.stop(run.id), manager.stop(run.id)])
    await expect(stopped).resolves.toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure }
    ])
    expect(harness.killer.hangup).toHaveBeenCalledTimes(1)
    expect(harness.killer.interrupt).not.toHaveBeenCalled()
    expect(harness.killer.forceKill).not.toHaveBeenCalled()
    expect(manager.list()).toEqual([run])
    expect(updatedStates(harness, run)).toEqual([
      { status: 'running', stopped: false },
      { status: 'stopping', stopped: true },
      { status: 'running', stopped: false }
    ])

    harness.killer.hangup.mockImplementation(async (pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    await Promise.all([manager.stop(run.id), manager.stop(run.id)])
    expect(harness.killer.hangup).toHaveBeenCalledTimes(2)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: run.id, status: 'exited', stopped: true, exitCode: 0 })
    ])
  })

  it('preserves an exit reported before interrupt throws instead of restoring a finished run', async () => {
    const failure = Object.assign(new Error('interrupt failed after exit'), { code: 'EPERM' })
    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(23)
      throw failure
    })
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    await expect(manager.stop(run.id)).rejects.toBe(failure)
    expect(manager.list()).toEqual([
      expect.objectContaining({
        id: run.id,
        status: 'exited',
        stopped: true,
        exitCode: 23,
        endedAt: '2026-10-02T12:00:00.000Z'
      })
    ])
    expect(updatedStates(harness, run)).toEqual([
      { status: 'running', stopped: false },
      { status: 'stopping', stopped: true },
      { status: 'exited', stopped: true }
    ])
    await manager.dispose()
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(1)
  })

  it('rejects concurrent stops when forceKill fails after grace, then retries the complete stop flow', async () => {
    const failure = Object.assign(new Error('cannot force-kill'), { code: 'EPERM' })
    harness.killer.forceKill.mockRejectedValueOnce(failure)
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopped = Promise.allSettled([manager.stop(run.id), manager.stop(run.id)])
    expect(manager.list()[0]).toMatchObject({ status: 'stopping', stopped: true })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(stopped).resolves.toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure }
    ])
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(1)
    expect(harness.killer.forceKill).toHaveBeenCalledExactlyOnceWith(run.pid)
    expect(manager.list()).toEqual([run])
    expect(updatedStates(harness, run)).toEqual([
      { status: 'running', stopped: false },
      { status: 'stopping', stopped: true },
      { status: 'running', stopped: false }
    ])

    harness.killer.forceKill.mockImplementation(async (pid) => {
      harness.ptys.find((candidate) => candidate.pid === pid)?.emitExit(137)
    })
    const retry = Promise.all([manager.stop(run.id), manager.stop(run.id)])
    await vi.advanceTimersByTimeAsync(1000)
    await retry
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(2)
    expect(harness.killer.forceKill).toHaveBeenCalledTimes(2)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: run.id, status: 'exited', stopped: true, exitCode: 137 })
    ])
  })

  it('does not spawn a replacement after stop fails and releases its launch queue for a later retry', async () => {
    const first: Script = {
      id: 'custom:first',
      name: 'first',
      source: 'custom',
      command: 'first',
      ports: [5173]
    }
    const replacement: Script = {
      ...first,
      id: 'custom:replacement',
      name: 'replacement',
      command: 'replacement'
    }
    const releasePorts = vi.fn<NonNullable<RunManagerDeps['releasePorts']>>(async () => undefined)
    const manager = harness.makeManager({
      scripts: {
        async find(projectId, scriptId) {
          const script = [first, replacement].find((candidate) => candidate.id === scriptId)
          if (projectId !== project.id || !script) {
            throw new DevhubError('SCRIPT_NOT_FOUND', 'script missing')
          }
          return { project, script }
        }
      },
      portConflictPolicy: async () => 'terminate',
      releasePorts
    })
    const running = await manager.start(project.id, first.id)
    const failure = Object.assign(new Error('cannot stop port holder'), { code: 'EPERM' })
    harness.killer.interrupt.mockImplementationOnce(() => {
      throw failure
    })
    await expect(manager.start(project.id, replacement.id)).rejects.toBe(failure)
    expect(harness.spawned).toHaveLength(1)
    expect(releasePorts).toHaveBeenCalledTimes(1)
    expect(manager.list()).toEqual([running])

    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    const replaced = await manager.start(project.id, replacement.id)
    expect(harness.spawned).toHaveLength(2)
    expect(releasePorts).toHaveBeenCalledTimes(2)
    expect(releasePorts).toHaveBeenLastCalledWith(replacement, [])
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: running.id, status: 'exited', stopped: true }),
      expect.objectContaining({ id: replaced.id, status: 'running', stopped: false })
    ])
    await manager.dispose()
  })

  it('rejects a failed dispose after stop failure and permits a later disposal attempt', async () => {
    const failure = Object.assign(new Error('cannot interrupt'), { code: 'EPERM' })
    harness.killer.interrupt.mockImplementation(() => {
      throw failure
    })
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    await expect(manager.stop(run.id)).rejects.toBe(failure)
    await expect(manager.dispose()).rejects.toBe(failure)
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(2)
    expect(manager.list()).toEqual([run])

    harness.killer.interrupt.mockImplementation((pty) => {
      harness.ptys.find((candidate) => candidate.pid === pty.pid)?.emitExit(0)
    })
    await Promise.all([manager.dispose(), manager.dispose()])
    expect(harness.killer.interrupt).toHaveBeenCalledTimes(3)
    expect(manager.list()).toEqual([
      expect.objectContaining({ id: run.id, status: 'exited', stopped: true, exitCode: 0 })
    ])
  })
})
