import type { DevhubEvent, DevhubEvents } from '@devhub/shared'

export class MockEventManager implements DevhubEvents {
  private listeners = new Set<(event: DevhubEvent) => void>()

  subscribe(listener: (event: DevhubEvent) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: DevhubEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch {
        // Ignore listener exceptions
      }
    })
  }
}

export const mockEvents = new MockEventManager()
