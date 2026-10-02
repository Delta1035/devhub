import { describe, expect, it } from 'vitest'
import type { UpdateStatus } from '@devhub/shared'
import { describeUpdateError, nextUpdateStatus, updateSupport } from './update-status'

const now = () => new Date('2026-10-02T12:00:00.000Z')

describe('updateSupport', () => {
  it.each([
    [{ isPackaged: false, platform: 'win32' as const, appImage: undefined }, '开发版本不检查更新'],
    [{ isPackaged: true, platform: 'win32' as const, appImage: undefined }, null],
    [{ isPackaged: true, platform: 'linux' as const, appImage: '/opt/devhub.AppImage' }, null],
    [
      { isPackaged: true, platform: 'linux' as const, appImage: undefined },
      '通过 deb 安装时，请用系统的包管理器更新'
    ]
  ])('%o → %s', (input, expected) => {
    expect(updateSupport(input)).toBe(expected)
  })
})

describe('nextUpdateStatus', () => {
  const idle: UpdateStatus = { state: 'idle' }

  it('walks through check, download and ready', () => {
    let status = nextUpdateStatus(idle, { type: 'checking' }, now)
    expect(status).toEqual({ state: 'checking' })
    status = nextUpdateStatus(status, { type: 'available', version: '0.2.0' }, now)
    expect(status).toEqual({ state: 'available', version: '0.2.0' })
    status = nextUpdateStatus(status, { type: 'progress', percent: 41.6 }, now)
    expect(status).toEqual({ state: 'downloading', version: '0.2.0', percent: 42 })
    status = nextUpdateStatus(status, { type: 'downloaded', version: '0.2.0' }, now)
    expect(status).toEqual({ state: 'downloaded', version: '0.2.0' })
  })

  it('records when it found nothing new', () => {
    expect(nextUpdateStatus(idle, { type: 'not-available' }, now)).toEqual({
      state: 'up-to-date',
      checkedAt: '2026-10-02T12:00:00.000Z'
    })
  })

  it('keeps a downloaded update when a periodic check runs again', () => {
    const ready: UpdateStatus = { state: 'downloaded', version: '0.2.0' }
    expect(nextUpdateStatus(ready, { type: 'checking' }, now)).toBe(ready)
    expect(nextUpdateStatus(ready, { type: 'available', version: '0.2.0' }, now)).toBe(ready)
    expect(nextUpdateStatus(ready, { type: 'available', version: '0.3.0' }, now)).toEqual({
      state: 'available',
      version: '0.3.0'
    })
  })

  it('turns errors into a short message', () => {
    expect(
      nextUpdateStatus(
        idle,
        { type: 'error', error: new Error('getaddrinfo ENOTFOUND api.github.com') },
        now
      )
    ).toEqual({ state: 'error', message: '无法连接 GitHub，请检查网络' })
  })
})

describe('describeUpdateError', () => {
  it('explains a release without update metadata', () => {
    expect(
      describeUpdateError(new Error('Cannot find latest.yml in the latest release artifacts'))
    ).toBe('最新发布中没有更新信息（latest.yml）')
  })

  it('keeps only the first line of other errors', () => {
    expect(describeUpdateError(new Error('boom\n  at stack'))).toBe('boom')
  })
})
