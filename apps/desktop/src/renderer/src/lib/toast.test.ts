import { describe, expect, it } from 'vitest'
import { toast } from './toast'

describe('ToastManager', () => {
  it('adds and dismisses toasts', () => {
    let callCount = 0
    const unsubscribe = toast.subscribe(() => {
      callCount++
    })

    const id = toast.success('测试成功消息')
    expect(callCount).toBe(1)
    expect(toast.getSnapshot().some((t) => t.id === id)).toBe(true)
    expect(toast.getSnapshot().find((t) => t.id === id)?.message).toBe('测试成功消息')
    expect(toast.getSnapshot().find((t) => t.id === id)?.type).toBe('success')

    toast.dismiss(id)
    expect(callCount).toBe(2)
    expect(toast.getSnapshot().some((t) => t.id === id)).toBe(false)

    unsubscribe()
  })
})
