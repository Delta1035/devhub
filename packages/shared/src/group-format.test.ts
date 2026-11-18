import { describe, expect, it } from 'vitest'
import {
  describeCondition,
  formatDuration,
  getConditionBadge,
  stepStateLabels
} from './group-format'

describe('formatDuration', () => {
  it('formats undefined or null or negative as —', () => {
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(-10)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })

  it('formats under 1 second', () => {
    expect(formatDuration(500)).toBe('< 1s')
    expect(formatDuration(0)).toBe('< 1s')
  })

  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1s')
    expect(formatDuration(48000)).toBe('48s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(134000)).toBe('2m 14s')
    expect(formatDuration(60000)).toBe('1m 0s')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h 0m')
    expect(formatDuration(3900000)).toBe('1h 5m')
  })
})

describe('describeCondition and getConditionBadge', () => {
  it('handles delay condition', () => {
    const cond = { type: 'delay' as const, seconds: 5 }
    expect(describeCondition(cond)).toBe('等待 5 秒')
    expect(getConditionBadge(cond)).toEqual({ text: '等待 5s', timeoutText: '' })
  })

  it('handles exit condition', () => {
    const cond = { type: 'exit' as const, timeoutSeconds: 30 }
    expect(describeCondition(cond)).toBe('进程成功退出 · 超时 30 秒')
    expect(getConditionBadge(cond)).toEqual({ text: '进程退出码 0', timeoutText: '超时 30s' })
  })

  it('handles output condition text and regex', () => {
    const textCond = { type: 'output' as const, text: 'ready', timeoutSeconds: 60 }
    expect(describeCondition(textCond)).toBe('输出出现文字「ready」 · 超时 60 秒')
    expect(getConditionBadge(textCond)).toEqual({ text: '包含 "ready"', timeoutText: '超时 60s' })

    const regexCond = { type: 'output' as const, text: 'ready', regex: true, timeoutSeconds: 60 }
    expect(describeCondition(regexCond)).toBe('输出匹配正则「ready」 · 超时 60 秒')
    expect(getConditionBadge(regexCond)).toEqual({ text: '正则 /ready/', timeoutText: '超时 60s' })
  })

  it('handles port condition', () => {
    const cond = { type: 'port' as const, port: 8080, timeoutSeconds: 45 }
    expect(describeCondition(cond)).toBe('端口 8080 可连接 · 超时 45 秒')
    expect(getConditionBadge(cond)).toEqual({ text: '端口 8080', timeoutText: '超时 45s' })
  })

  it('handles http condition', () => {
    const cond = { type: 'http' as const, url: 'http://localhost:3000', timeoutSeconds: 20 }
    expect(describeCondition(cond)).toBe('HTTP 返回成功：http://localhost:3000 · 超时 20 秒')
    expect(getConditionBadge(cond)).toEqual({
      text: 'HTTP 200 http://localhost:3000',
      timeoutText: '超时 20s'
    })
  })
})

describe('stepStateLabels', () => {
  it('has entries for all step states', () => {
    expect(stepStateLabels.pending).toBe('等待启动')
    expect(stepStateLabels.running).toBe('启动中')
    expect(stepStateLabels.done).toBe('条件满足')
    expect(stepStateLabels.failed).toBe('失败')
    expect(stepStateLabels.cancelled).toBe('已取消')
  })
})
