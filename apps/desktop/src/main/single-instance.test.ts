import { mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireSingleInstanceLock } from './single-instance'

const host = 'devhub-test-host'
let directory: string | null = null

function tempUserData(): string {
  directory = mkdtempSync(join(tmpdir(), 'devhub-single-instance-'))
  return directory
}

function createSingletonLinks(userData: string, pid: number): void {
  const socketDir = join(userData, 'socket')
  mkdirSync(socketDir)
  symlinkSync(`${host}-${pid}`, join(userData, 'SingletonLock'))
  symlinkSync('cookie', join(userData, 'SingletonCookie'))
  symlinkSync(join(socketDir, 'SingletonSocket'), join(userData, 'SingletonSocket'))
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true })
  directory = null
})

describe('acquireSingleInstanceLock', () => {
  it('keeps the first successfully acquired lock', () => {
    const requestSingleInstanceLock = vi.fn(() => true)

    expect(
      acquireSingleInstanceLock({
        app: { requestSingleInstanceLock },
        platform: 'linux',
        userData: tempUserData(),
        hostname: host
      })
    ).toEqual({ status: 'primary', recoveredStaleLock: false })
    expect(requestSingleInstanceLock).toHaveBeenCalledOnce()
  })

  it('leaves a live owner untouched and treats this launch as secondary', () => {
    const userData = tempUserData()
    createSingletonLinks(userData, 123)

    expect(
      acquireSingleInstanceLock({
        app: { requestSingleInstanceLock: () => false },
        platform: 'linux',
        userData,
        hostname: host,
        isProcessAlive: () => true
      })
    ).toEqual({ status: 'secondary' })
    expect(readlinkSync(join(userData, 'SingletonLock'))).toBe(`${host}-123`)
  })

  it('removes dead-owner links and retries the Electron lock once', () => {
    const userData = tempUserData()
    createSingletonLinks(userData, 456)
    const requestSingleInstanceLock = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)

    expect(
      acquireSingleInstanceLock({
        app: { requestSingleInstanceLock },
        platform: 'linux',
        userData,
        hostname: host,
        isProcessAlive: () => false
      })
    ).toEqual({ status: 'primary', recoveredStaleLock: true })
    expect(requestSingleInstanceLock).toHaveBeenCalledTimes(2)
    for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
      expect(() => readlinkSync(join(userData, name))).toThrow()
    }
  })

  it('reports a stale lock that still blocks the retry', () => {
    const userData = tempUserData()
    createSingletonLinks(userData, 789)
    const links = new Map([
      [join(userData, 'SingletonLock'), `${host}-789`],
      [join(userData, 'SingletonCookie'), 'cookie'],
      [join(userData, 'SingletonSocket'), '/tmp/devhub-test-socket']
    ])

    const result = acquireSingleInstanceLock({
      app: { requestSingleInstanceLock: () => false },
      platform: 'linux',
      userData,
      hostname: host,
      isProcessAlive: () => false,
      files: {
        readlink: (path) =>
          links.get(path) ??
          (() => {
            throw new Error('missing')
          })(),
        // Simulate a filesystem that accepts unlink but keeps returning the stale link.
        unlink: () => undefined
      }
    })

    expect(result.status).toBe('failed')
    expect(result).toMatchObject({ message: expect.stringContaining(`${host}-789`) })
  })

  it('does not remove links if another owner replaces the lock during inspection', () => {
    const userData = tempUserData()
    const lockPath = join(userData, 'SingletonLock')
    let lockReads = 0
    const unlink = vi.fn()

    const result = acquireSingleInstanceLock({
      app: { requestSingleInstanceLock: () => false },
      platform: 'linux',
      userData,
      hostname: host,
      isProcessAlive: (pid) => pid === 222,
      files: {
        readlink: (path) => {
          if (path !== lockPath) throw new Error('missing')
          lockReads += 1
          return lockReads === 1 ? `${host}-111` : `${host}-222`
        },
        unlink
      }
    })

    expect(result).toEqual({ status: 'secondary' })
    expect(unlink).not.toHaveBeenCalled()
  })

  it('does not remove a lock created under another hostname', () => {
    const userData = tempUserData()
    createSingletonLinks(userData, 321)

    expect(
      acquireSingleInstanceLock({
        app: { requestSingleInstanceLock: () => false },
        platform: 'linux',
        userData,
        hostname: 'another-host',
        isProcessAlive: () => false
      })
    ).toEqual({ status: 'secondary' })
    expect(readlinkSync(join(userData, 'SingletonLock'))).toBe(`${host}-321`)
  })
})
