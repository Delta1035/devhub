import type { UpdateStatus } from '@devhub/shared'

/** Events electron-updater emits, reduced to what the status needs. */
export type UpdaterEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; error: unknown }

export interface UpdateSupport {
  isPackaged: boolean
  platform: NodeJS.Platform
  /** Set by the AppImage runtime. */
  appImage: string | undefined
  /** Written by electron-builder into the installed deb's resources. */
  packageType: string | undefined
}

/** electron-updater selects the matching installer for NSIS, AppImage and deb. */
export function updateSupport({
  isPackaged,
  platform,
  appImage,
  packageType
}: UpdateSupport): string | null {
  if (!isPackaged) return '开发版本不检查更新'
  if (platform === 'win32') return null
  if (platform === 'linux')
    return appImage || packageType === 'deb' ? null : '当前 Linux 安装方式不支持自动更新'
  return '当前系统不支持自动更新'
}

export function nextUpdateStatus(
  current: UpdateStatus,
  event: UpdaterEvent,
  now: () => Date = () => new Date()
): UpdateStatus {
  switch (event.type) {
    case 'checking':
      // A periodic check must not hide an update that is already downloading or ready.
      return current.state === 'downloading' || current.state === 'downloaded'
        ? current
        : { state: 'checking' }
    case 'available':
      return current.state === 'downloaded' && current.version === event.version
        ? current
        : { state: 'available', version: event.version }
    case 'not-available':
      return { state: 'up-to-date', checkedAt: now().toISOString() }
    case 'progress': {
      const version = 'version' in current ? current.version : ''
      return { state: 'downloading', version, percent: Math.round(event.percent) }
    }
    case 'downloaded':
      return { state: 'downloaded', version: event.version }
    case 'error':
      return { state: 'error', message: describeUpdateError(event.error) }
  }
}

/** Short, user-facing reasons for the common failures; electron-updater's own are verbose. */
export function describeUpdateError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(text)) return '无法连接 GitHub，请检查网络'
  if (/latest(-linux)?\.yml|404/i.test(text)) return '最新发布中没有更新信息（latest.yml）'
  return text.split('\n')[0]?.slice(0, 200) ?? '检查更新失败'
}
