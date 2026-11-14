import { useSyncExternalStore } from 'react'
import { toast } from './toast'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface NotificationItem {
  id: string
  title?: string
  message: string
  type: NotificationType
  timestamp: number
  read: boolean
}

export interface NotifyOptions {
  title?: string
  message: string
  type?: NotificationType
  showToast?: boolean
}

const MAX_NOTIFICATIONS = 50

class NotificationManager {
  private notifications: NotificationItem[] = []
  private listeners = new Set<() => void>()
  private nextId = 1

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): NotificationItem[] => {
    return this.notifications
  }

  unreadCount = (): number => {
    return this.notifications.filter((n) => !n.read).length
  }

  show(options: NotifyOptions): string {
    const id = `notify-${++this.nextId}-${Date.now()}`
    const type = options.type ?? 'info'
    const item: NotificationItem = {
      id,
      title: options.title,
      message: options.message,
      type,
      timestamp: Date.now(),
      read: false
    }

    // Newest first, keep up to MAX_NOTIFICATIONS
    this.notifications = [item, ...this.notifications].slice(0, MAX_NOTIFICATIONS)
    this.notify()

    if (options.showToast !== false) {
      const toastText = options.title ? `${options.title}: ${options.message}` : options.message
      toast.show(toastText, { type })
    }

    return id
  }

  error(message: string, title?: string, showToast = true): string {
    return this.show({ message, title, type: 'error', showToast })
  }

  success(message: string, title?: string, showToast = true): string {
    return this.show({ message, title, type: 'success', showToast })
  }

  warning(message: string, title?: string, showToast = true): string {
    return this.show({ message, title, type: 'warning', showToast })
  }

  info(message: string, title?: string, showToast = true): string {
    return this.show({ message, title, type: 'info', showToast })
  }

  markAsRead(id: string): void {
    let changed = false
    this.notifications = this.notifications.map((n) => {
      if (n.id === id && !n.read) {
        changed = true
        return { ...n, read: true }
      }
      return n
    })
    if (changed) {
      this.notify()
    }
  }

  markAllAsRead(): void {
    const hasUnread = this.notifications.some((n) => !n.read)
    if (!hasUnread) return
    this.notifications = this.notifications.map((n) => (n.read ? n : { ...n, read: true }))
    this.notify()
  }

  clear(): void {
    if (this.notifications.length === 0) return
    this.notifications = []
    this.notify()
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }
}

export const notify = new NotificationManager()

export function formatNotificationTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function useNotifications(): NotificationItem[] {
  return useSyncExternalStore(notify.subscribe, notify.getSnapshot, notify.getSnapshot)
}

export function useUnreadNotificationsCount(): number {
  return useSyncExternalStore(
    notify.subscribe,
    () => notify.unreadCount(),
    () => 0
  )
}
