import { useSyncExternalStore } from 'react'

export interface ToastItem {
  id: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  durationMs?: number
}

class ToastManager {
  private toasts: ToastItem[] = []
  private listeners = new Set<() => void>()
  private nextId = 1

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): ToastItem[] => {
    return this.toasts
  }

  show(
    message: string,
    options?: { type?: 'info' | 'success' | 'warning' | 'error'; durationMs?: number }
  ): string {
    const id = `toast-${++this.nextId}-${Date.now()}`
    const item: ToastItem = {
      id,
      message,
      type: options?.type ?? 'info',
      durationMs: options?.durationMs ?? 2500
    }
    this.toasts = [...this.toasts, item]
    this.notify()

    setTimeout(() => {
      this.dismiss(id)
    }, item.durationMs)

    return id
  }

  success(message: string, durationMs?: number): string {
    return this.show(message, { type: 'success', durationMs })
  }

  info(message: string, durationMs?: number): string {
    return this.show(message, { type: 'info', durationMs })
  }

  error(message: string, durationMs?: number): string {
    return this.show(message, { type: 'error', durationMs })
  }

  dismiss(id: string): void {
    const prevLen = this.toasts.length
    this.toasts = this.toasts.filter((t) => t.id !== id)
    if (this.toasts.length !== prevLen) {
      this.notify()
    }
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }
}

export const toast = new ToastManager()

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(toast.subscribe, toast.getSnapshot, toast.getSnapshot)
}
