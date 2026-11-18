import { beforeEach, describe, expect, it } from 'vitest'
import { formatNotificationTime, notify } from './notifications'
import { toast } from './toast'

describe('NotificationManager', () => {
  beforeEach(() => {
    notify.clear()
    // clear toasts
    toast.getSnapshot().forEach((t) => toast.dismiss(t.id))
  })

  it('records notifications and updates unread count', () => {
    expect(notify.unreadCount()).toBe(0)

    const id = notify.error('项目已存在：ZTools', '操作失败')
    expect(notify.unreadCount()).toBe(1)

    const items = notify.getSnapshot()
    expect(items.length).toBe(1)
    const first = items[0]
    expect(first).toBeDefined()
    expect(first?.id).toBe(id)
    expect(first?.title).toBe('操作失败')
    expect(first?.message).toBe('项目已存在：ZTools')
    expect(first?.type).toBe('error')
    expect(first?.read).toBe(false)

    // Also triggered toast
    const toasts = toast.getSnapshot()
    expect(toasts.some((t) => t.message === '操作失败: 项目已存在：ZTools')).toBe(true)

    // Mark as read
    notify.markAsRead(id)
    expect(notify.unreadCount()).toBe(0)
    expect(notify.getSnapshot()[0]?.read).toBe(true)
  })

  it('marks all as read and clears', () => {
    notify.info('消息 1')
    notify.warning('消息 2')
    expect(notify.unreadCount()).toBe(2)

    notify.markAllAsRead()
    expect(notify.unreadCount()).toBe(0)
    expect(notify.getSnapshot().length).toBe(2)

    notify.clear()
    expect(notify.getSnapshot().length).toBe(0)
  })

  it('supports disabling toast dispatch', () => {
    notify.show({
      title: '后台扫描',
      message: '扫描完成',
      type: 'info',
      showToast: false
    })

    expect(notify.getSnapshot().length).toBe(1)
    expect(toast.getSnapshot().some((t) => t.message.includes('后台扫描'))).toBe(false)
  })

  it('formats notification time accurately', () => {
    const base = 1700000000000
    expect(formatNotificationTime(base, base + 10_000)).toBe('刚刚')
    expect(formatNotificationTime(base, base + 120_000)).toBe('2 分钟前')
    const hoursLater = base + 7200_000
    const d = new Date(base)
    const expected = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    expect(formatNotificationTime(base, hoursLater)).toBe(expected)
  })
})
