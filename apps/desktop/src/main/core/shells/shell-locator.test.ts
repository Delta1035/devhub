import { describe, expect, it, vi } from 'vitest'
import { createShellLocator, gitBashStartup } from './shell-locator'

const winStartupDir = 'C:\\Users\\me\\DevHub\\shell'

const locatorOn = (
  platform: NodeJS.Platform,
  files: string[],
  options: {
    env?: NodeJS.ProcessEnv
    registry?: Record<string, string>
    writeFile?: (path: string, content: string) => Promise<void>
  } = {}
) =>
  createShellLocator({
    platform,
    env: options.env ?? {},
    exists: async (path) => files.includes(path),
    listDir: async () => [],
    queryRegistry: async (key) => options.registry?.[key] ?? '',
    startupDir: platform === 'win32' ? winStartupDir : '/home/me/.config/DevHub/shell',
    writeFile: options.writeFile ?? (async () => undefined)
  })

const winEnv = {
  PATH: 'C:\\Windows\\System32;D:\\software\\Git\\cmd',
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
  SystemRoot: 'C:\\Windows',
  ComSpec: 'C:\\Windows\\system32\\cmd.exe',
  ProgramFiles: 'C:\\Program Files'
}
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const gitRegistry = [
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\GitForWindows',
  '    CurrentVersion    REG_SZ    2.53.0',
  '    InstallPath    REG_SZ    D:\\software\\Git',
  ''
].join('\r\n')

describe('shell locator on Windows', () => {
  it('lists installed shells with Git Bash first, as the default', async () => {
    const shells = await locatorOn(
      'win32',
      ['D:\\software\\Git\\bin\\bash.exe', powershell, 'C:\\Windows\\system32\\cmd.exe'],
      { env: winEnv, registry: { 'HKLM\\SOFTWARE\\GitForWindows': gitRegistry } }
    ).list()

    expect(shells.map((shell) => shell.id)).toEqual(['git-bash', 'powershell', 'cmd'])
    expect(shells[0]).toEqual({
      id: 'git-bash',
      name: 'Git Bash',
      file: 'D:\\software\\Git\\bin\\bash.exe',
      // Long options before -i; the rcfile path uses forward slashes for MSYS bash.
      args: ['--rcfile', 'C:/Users/me/DevHub/shell/git-bash.rc', '-i'],
      env: { CHERE_INVOKING: '1' },
      startupFile: { path: `${winStartupDir}\\git-bash.rc`, content: gitBashStartup }
    })
  })

  it.each([
    [
      'git.exe in <root>\\cmd',
      'D:\\software\\Git\\cmd\\git.exe',
      'D:\\software\\Git\\bin\\bash.exe'
    ],
    ['git.exe in <root>\\mingw64\\bin', 'E:\\Git\\mingw64\\bin\\git.exe', 'E:\\Git\\bin\\bash.exe']
  ])('derives Git Bash from %s on PATH', async (_label, git, bash) => {
    const env = { ...winEnv, PATH: `C:\\Windows\\System32;${git.slice(0, git.lastIndexOf('\\'))}` }
    const [first] = await locatorOn('win32', [git, bash], { env }).list()
    expect(first).toMatchObject({ id: 'git-bash', file: bash })
  })

  it("never picks WSL's bash.exe from System32", async () => {
    const shells = await locatorOn('win32', ['C:\\Windows\\System32\\bash.exe', powershell], {
      env: winEnv
    }).list()
    expect(shells.map((shell) => shell.id)).toEqual(['powershell'])
  })

  it('finds PowerShell 7 in its default directory', async () => {
    const pwsh = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    const shells = await locatorOn('win32', [pwsh], { env: winEnv }).list()
    expect(shells).toEqual([
      { id: 'pwsh', name: 'PowerShell 7', file: pwsh, args: ['-NoLogo'], env: {} }
    ])
  })

  it('writes the Git Bash startup file in prepare, and nothing for other shells', async () => {
    const writeFile = vi.fn(async () => undefined)
    const locator = locatorOn('win32', ['C:\\Program Files\\Git\\bin\\bash.exe', powershell], {
      env: winEnv,
      writeFile
    })
    const [gitBash, ps] = await locator.list()
    await locator.prepare(ps!)
    expect(writeFile).not.toHaveBeenCalled()
    await locator.prepare(gitBash!)
    expect(writeFile).toHaveBeenCalledWith(`${winStartupDir}\\git-bash.rc`, gitBashStartup)
  })
})

describe('Git Bash startup file', () => {
  it('reads the login files in the order a login shell would', () => {
    const order = ['/etc/profile', '~/.bash_profile', '~/.bash_login', '~/.profile'].map((file) =>
      gitBashStartup.indexOf(file)
    )
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("only removes aliases that wrap a program in winpty, keeping the user's own", () => {
    expect(gitBashStartup).toContain(`*"='winpty "*) unalias "$name"`)
  })
})

describe('shell locator on Linux', () => {
  it('lists login shells with bash first', async () => {
    const shells = await locatorOn('linux', ['/bin/sh', '/usr/bin/zsh', '/bin/bash']).list()
    expect(shells).toEqual([
      { id: 'bash', name: 'bash', file: '/bin/bash', args: ['-l'], env: {} },
      { id: 'zsh', name: 'zsh', file: '/usr/bin/zsh', args: ['-l'], env: {} },
      { id: 'sh', name: 'sh', file: '/bin/sh', args: ['-l'], env: {} }
    ])
  })

  it('returns nothing when no known shell exists', async () => {
    await expect(locatorOn('linux', []).list()).resolves.toEqual([])
  })
})
