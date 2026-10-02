import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHarness, type TestHarness } from './run-manager.fixtures'

describe('createRunManager events and terminal I/O', () => {
  let harness: TestHarness

  beforeEach(() => {
    vi.useFakeTimers()
    harness = createHarness()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const eventTypes = () =>
    harness.events.map((event) =>
      event.type === 'run-updated' ? `updated:${event.run.status}` : event.type
    )

  it('announces start, stopping and exit', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    const stopping = manager.stop(run.id)
    harness.ptys[0]?.emitExit(0)
    await stopping
    expect(eventTypes()).toEqual(['updated:running', 'updated:stopping', 'updated:exited'])
    expect(harness.events.at(-1)).toMatchObject({
      type: 'run-updated',
      run: { id: run.id, status: 'exited', stopped: true, exitCode: 0 }
    })
  })

  it('streams coalesced output with stream offsets', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    harness.ptys[0]?.emitData('ab')
    harness.ptys[0]?.emitData('c')
    await vi.advanceTimersByTimeAsync(16)
    harness.ptys[0]?.emitData('d')
    await vi.advanceTimersByTimeAsync(16)
    expect(harness.events.filter((event) => event.type === 'run-output')).toEqual([
      { type: 'run-output', runId: run.id, offset: 0, data: 'abc' },
      { type: 'run-output', runId: run.id, offset: 3, data: 'd' }
    ])
  })

  it('flushes pending output before announcing the exit', async () => {
    const manager = harness.makeManager()
    await manager.start('p1', 'npm:dev')
    harness.ptys[0]?.emitData('bye')
    harness.ptys[0]?.emitExit(0)
    expect(eventTypes()).toEqual(['updated:running', 'run-output', 'updated:exited'])
  })

  it('announces removal when an exited run is replaced by a new start', async () => {
    const manager = harness.makeManager()
    const first = await manager.start('p1', 'npm:dev')
    harness.ptys[0]?.emitExit(0)
    await manager.start('p1', 'npm:dev')
    expect(harness.events).toContainEqual({ type: 'run-removed', runId: first.id })
  })

  it('writes terminal input to active runs only', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    manager.writeInput(run.id, 'y\r')
    expect(harness.ptys[0]?.written).toEqual(['y\r'])

    harness.ptys[0]?.emitExit(0)
    expect(() => manager.writeInput(run.id, 'y\r')).toThrow(
      expect.objectContaining({ code: 'RUN_NOT_ACTIVE' })
    )
  })

  it('accepts input while stopping, e.g. to answer a batch-job prompt', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    void manager.stop(run.id)
    manager.writeInput(run.id, 'Y\r')
    expect(harness.ptys[0]?.written).toEqual(['Y\r'])
  })

  it.each([[42], ['x'.repeat(64 * 1024 + 1)]])('rejects invalid input', async (data) => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    expect(() => manager.writeInput(run.id, data)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' })
    )
  })

  it('resizes the terminal and ignores resizes after exit', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    manager.resize(run.id, 100, 40)
    harness.ptys[0]?.emitExit(0)
    manager.resize(run.id, 80, 24)
    expect(harness.ptys[0]?.sizes).toEqual([[100, 40]])
  })

  it.each([
    [0, 24],
    [80, 0],
    [80.5, 24],
    ['80', 24],
    [5000, 24]
  ])('rejects invalid terminal size %s x %s', async (cols, rows) => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    expect(() => manager.resize(run.id, cols, rows)).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' })
    )
  })

  it('swallows resize errors from a process that just exited', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    vi.spyOn(harness.ptys[0]!, 'resize').mockImplementation(() => {
      throw new Error('Cannot resize a pty that has already exited')
    })
    expect(() => manager.resize(run.id, 100, 40)).not.toThrow()
  })

  it('removes exited runs and refuses to remove active ones', async () => {
    const manager = harness.makeManager()
    const run = await manager.start('p1', 'npm:dev')
    expect(() => manager.remove(run.id)).toThrow(
      expect.objectContaining({ code: 'RUN_STILL_ACTIVE' })
    )

    harness.ptys[0]?.emitExit(0)
    manager.remove(run.id)
    expect(manager.list()).toEqual([])
    expect(harness.events.at(-1)).toEqual({ type: 'run-removed', runId: run.id })
    expect(() => manager.output(run.id)).toThrow(expect.objectContaining({ code: 'RUN_NOT_FOUND' }))
  })
})
