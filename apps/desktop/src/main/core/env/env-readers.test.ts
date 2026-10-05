import { describe, expect, it } from 'vitest'
import { readRegistryKey, runInLoginShell } from './env-readers'
import { parseRegistryValues } from './windows-env'
import { parseShellEnv, shellEnvCommand } from './shell-env'

describe('env readers on the real system', () => {
  it.runIf(process.platform === 'win32')('reads the machine key even without a PATH', async () => {
    const output = await readRegistryKey(
      'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
      { SystemRoot: process.env.SystemRoot ?? 'C:\\Windows' }
    )
    const names = parseRegistryValues(output).map(({ name }) => name.toLowerCase())
    expect(names).toContain('path')
  })

  it.runIf(process.platform !== 'win32')('captures the environment of a login shell', async () => {
    const marker = '__DEVHUB_ENV_test__'
    const stdout = await runInLoginShell(
      '/bin/sh',
      `echo noise; ${shellEnvCommand(marker)}`,
      { PATH: '/usr/bin:/bin', HOME: '/tmp', DEVHUB_PROBE: 'yes' },
      10_000
    )
    expect(parseShellEnv(stdout, marker)).toMatchObject({ DEVHUB_PROBE: 'yes' })
  })

  it.runIf(process.platform !== 'win32')('gives up on a shell that does not finish', async () => {
    await expect(
      runInLoginShell('/bin/sh', 'sleep 30', { PATH: '/usr/bin:/bin', HOME: '/tmp' }, 200)
    ).rejects.toThrow('did not finish within 200 ms')
  })
})
