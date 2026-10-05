import { describe, expect, it, vi } from 'vitest'
import { createLaunchEnvResolver, type LaunchEnvDeps } from './launch-env'

const marker = '__DEVHUB_ENV_test__'

const makeResolver = (overrides: Partial<LaunchEnvDeps>) => {
  const log = vi.fn()
  const resolve = createLaunchEnvResolver({
    platform: 'linux',
    env: {},
    readRegistryKey: async () => '',
    runInLoginShell: async () => '',
    log,
    newMarker: () => marker,
    ...overrides
  })
  return { resolve, log }
}

describe('createLaunchEnvResolver on Windows', () => {
  const registry: Record<string, string> = {
    'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment':
      'HKEY_LOCAL_MACHINE\\...\n    Path    REG_EXPAND_SZ    C:\\Windows;%NVM_SYMLINK%\n    NVM_SYMLINK    REG_SZ    C:\\nvm4w\\nodejs\n',
    'HKCU\\Environment': 'HKEY_CURRENT_USER\\Environment\n    Path    REG_SZ    C:\\Users\\u\\bin\n'
  }

  it('merges the registry variables into the inherited environment', async () => {
    const { resolve } = makeResolver({
      platform: 'win32',
      env: { Path: 'C:\\Windows;%NVM_SYMLINK%', EMPTY: undefined },
      readRegistryKey: async (key) => registry[key] ?? ''
    })
    await expect(resolve()).resolves.toEqual({
      Path: 'C:\\Windows;C:\\nvm4w\\nodejs;C:\\Users\\u\\bin',
      NVM_SYMLINK: 'C:\\nvm4w\\nodejs'
    })
  })

  it('reads the registry again once the cache expired', async () => {
    let time = 0
    const readRegistryKey = vi.fn(async (key: string) => registry[key] ?? '')
    const { resolve } = makeResolver({ platform: 'win32', readRegistryKey, now: () => time })
    await Promise.all([resolve(), resolve()])
    time = 4999
    await resolve()
    expect(readRegistryKey).toHaveBeenCalledTimes(2)
    time = 5000
    await resolve()
    expect(readRegistryKey).toHaveBeenCalledTimes(4)
  })

  it('uses the keys it could read when another fails', async () => {
    const { resolve, log } = makeResolver({
      platform: 'win32',
      env: { Path: 'C:\\Windows' },
      readRegistryKey: async (key) => {
        if (key === 'HKCU\\Environment') throw new Error('access denied')
        return registry[key] ?? ''
      }
    })
    await expect(resolve()).resolves.toMatchObject({ Path: 'C:\\Windows;C:\\nvm4w\\nodejs' })
    expect(log).toHaveBeenCalledWith('reading HKCU\\Environment failed', expect.any(Error))
  })
})

describe('createLaunchEnvResolver on Linux', () => {
  const inherited = { PATH: '/usr/bin', SHELL: '/bin/zsh', HOME: '/home/u', EMPTY: undefined }

  it('overlays the login shell environment, captured once', async () => {
    const runInLoginShell = vi.fn(
      async () => `${marker}PATH=/home/u/.nvm/bin:/usr/bin\0NVM_DIR=/home/u/.nvm\0${marker}`
    )
    const { resolve } = makeResolver({ env: inherited, runInLoginShell })
    const expected = {
      PATH: '/home/u/.nvm/bin:/usr/bin',
      SHELL: '/bin/zsh',
      HOME: '/home/u',
      NVM_DIR: '/home/u/.nvm'
    }
    await expect(resolve()).resolves.toEqual(expected)
    await expect(resolve()).resolves.toEqual(expected)
    expect(runInLoginShell).toHaveBeenCalledTimes(1)
    expect(runInLoginShell).toHaveBeenCalledWith(
      '/bin/zsh',
      expect.stringContaining(marker),
      { PATH: '/usr/bin', SHELL: '/bin/zsh', HOME: '/home/u' },
      10_000
    )
  })

  it('falls back to /bin/sh without SHELL', async () => {
    const runInLoginShell = vi.fn(async () => '')
    await makeResolver({ env: { PATH: '/usr/bin' }, runInLoginShell }).resolve()
    expect(runInLoginShell).toHaveBeenCalledWith(
      '/bin/sh',
      expect.any(String),
      expect.anything(),
      10_000
    )
  })

  it('keeps the inherited environment when the shell fails or prints none', async () => {
    const failing = makeResolver({
      env: inherited,
      runInLoginShell: async () => {
        throw new Error('timed out')
      }
    })
    await expect(failing.resolve()).resolves.toEqual({
      PATH: '/usr/bin',
      SHELL: '/bin/zsh',
      HOME: '/home/u'
    })
    expect(failing.log).toHaveBeenCalledWith(
      'capturing the environment of /bin/zsh failed',
      expect.any(Error)
    )

    const silent = makeResolver({ env: inherited, runInLoginShell: async () => 'oops' })
    await expect(silent.resolve()).resolves.toMatchObject({ PATH: '/usr/bin' })
    expect(silent.log).toHaveBeenCalledWith('/bin/zsh printed no environment', 'oops')
  })
})
