import { readlinkSync, unlinkSync } from 'fs'
import { hostname } from 'os'
import { join } from 'path'

const singletonFiles = ['SingletonSocket', 'SingletonCookie', 'SingletonLock'] as const

interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean
}

interface LockFileOps {
  readlink(path: string): string
  unlink(path: string): void
}

interface AcquireSingleInstanceOptions {
  app: SingleInstanceApp
  platform: NodeJS.Platform
  userData: string
  hostname?: string
  isProcessAlive?: (pid: number) => boolean
  files?: LockFileOps
}

export type SingleInstanceResult =
  | { status: 'primary'; recoveredStaleLock: boolean }
  | { status: 'secondary' }
  | { status: 'failed'; message: string }

interface LockOwner {
  hostname: string
  pid: number
  target: string
}

const defaultFiles: LockFileOps = {
  readlink: readlinkSync,
  unlink: unlinkSync
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

function readLink(files: LockFileOps, path: string): string | null {
  try {
    return files.readlink(path)
  } catch {
    return null
  }
}

function readLockOwner(files: LockFileOps, userData: string): LockOwner | null {
  const target = readLink(files, join(userData, 'SingletonLock'))
  if (!target) return null

  const separator = target.lastIndexOf('-')
  if (separator <= 0) return null
  const pid = Number(target.slice(separator + 1))
  if (!Number.isSafeInteger(pid) || pid <= 0) return null
  return { hostname: target.slice(0, separator), pid, target }
}

function removeUnchangedStaleLinks(
  files: LockFileOps,
  userData: string,
  owner: LockOwner,
  isProcessAlive: (pid: number) => boolean
): void {
  const snapshot = new Map<string, string>()
  for (const name of singletonFiles) {
    const target = readLink(files, join(userData, name))
    if (target !== null) snapshot.set(name, target)
  }
  if (snapshot.get('SingletonLock') !== owner.target || isProcessAlive(owner.pid)) return

  // Remove the lock last, so another launcher cannot acquire it while its companion links
  // still belong to the dead process. Each comparison avoids deleting a replacement link.
  for (const name of singletonFiles) {
    const path = join(userData, name)
    const target = snapshot.get(name)
    if (target !== undefined && readLink(files, path) === target) files.unlink(path)
  }
}

export function acquireSingleInstanceLock({
  app,
  platform,
  userData,
  hostname: currentHostname = hostname(),
  isProcessAlive = processIsAlive,
  files = defaultFiles
}: AcquireSingleInstanceOptions): SingleInstanceResult {
  if (app.requestSingleInstanceLock()) {
    return { status: 'primary', recoveredStaleLock: false }
  }

  // Chromium normally cleans these links itself. Recover only the narrow case we can prove
  // safe: a lock created on this host whose owner PID no longer exists.
  if (platform !== 'linux') return { status: 'secondary' }
  const owner = readLockOwner(files, userData)
  if (!owner || owner.hostname !== currentHostname || isProcessAlive(owner.pid)) {
    return { status: 'secondary' }
  }

  try {
    removeUnchangedStaleLinks(files, userData, owner, isProcessAlive)
  } catch (error) {
    return {
      status: 'failed',
      message: `无法清理失效的单实例锁（${owner.target}）：${String(error)}`
    }
  }

  if (app.requestSingleInstanceLock()) {
    return { status: 'primary', recoveredStaleLock: true }
  }

  const remainingOwner = readLockOwner(files, userData)
  if (
    remainingOwner &&
    remainingOwner.hostname === currentHostname &&
    !isProcessAlive(remainingOwner.pid)
  ) {
    return {
      status: 'failed',
      message: `清理失效的单实例锁后仍无法启动（${remainingOwner.target}）`
    }
  }

  // Another launcher may have won the retry race and now owns the profile.
  return { status: 'secondary' }
}
