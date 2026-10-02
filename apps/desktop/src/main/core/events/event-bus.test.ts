import { describe, expect, it, vi } from 'vitest'
import type { DevhubEvent } from '@devhub/shared'
import { createEventBus } from './event-bus'

const event: DevhubEvent = { type: 'run-removed', runId: 'r1' }

describe('createEventBus', () => {
  it('delivers events to every subscriber until it unsubscribes', () => {
    const bus = createEventBus(vi.fn())
    const first = vi.fn()
    const second = vi.fn()
    const unsubscribe = bus.subscribe(first)
    bus.subscribe(second)

    bus.emit(event)
    unsubscribe()
    bus.emit(event)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('keeps delivering when one listener throws', () => {
    const onError = vi.fn()
    const bus = createEventBus(onError)
    const healthy = vi.fn()
    bus.subscribe(() => {
      throw new Error('broken transport')
    })
    bus.subscribe(healthy)

    bus.emit(event)

    expect(healthy).toHaveBeenCalledWith(event)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'broken transport' }))
  })

  it('treats the same function subscribed twice as two subscriptions', () => {
    const bus = createEventBus(vi.fn())
    const listener = vi.fn()
    const unsubscribeFirst = bus.subscribe(listener)
    bus.subscribe(listener)
    unsubscribeFirst()

    bus.emit(event)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
