import type { DevhubEvent, DevhubEvents } from '@devhub/shared'

export interface EventBus extends DevhubEvents {
  emit(event: DevhubEvent): void
}

/** Fans core events out to every transport (IPC today, SSE later). */
export function createEventBus(onListenerError: (error: unknown) => void): EventBus {
  const listeners = new Set<(event: DevhubEvent) => void>()
  return {
    emit(event) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (error) {
          // One broken transport must not stop events reaching the others.
          onListenerError(error)
        }
      }
    },
    subscribe(listener) {
      // Wrapped so subscribing the same function twice yields two independent subscriptions.
      const entry = (event: DevhubEvent): void => listener(event)
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    }
  }
}
