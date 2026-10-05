import { describe, expect, it } from 'vitest'
import { createTerminalLocator } from './terminal-locator'

/** A fake machine: the set of files that exist. */
const machine = (platform: NodeJS.Platform, files: string[], env: NodeJS.ProcessEnv) =>
  createTerminalLocator({
    platform,
    env,
    exists: async (path) => files.includes(path),
    listDir: async () => []
  })

const winEnv = {
  PATH: 'C:\\Windows\\system32;C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps',
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
  LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
  SystemRoot: 'C:\\Windows',
  ComSpec: 'C:\\Windows\\system32\\cmd.exe'
}
const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const wt = 'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe'

describe('terminal locator on Windows', () => {
  it('prefers Windows Terminal and opens it in the directory', async () => {
    const found = await machine('win32', [wt, powershell, winEnv.ComSpec], winEnv).locate()
    expect(found).toMatchObject({ name: 'Windows Terminal', path: wt })
    expect(found?.args('D:\\code\\web app')).toEqual(['-d', 'D:\\code\\web app'])
  })

  it('escapes semicolons, which Windows Terminal reads as command separators', async () => {
    const found = await machine('win32', [wt], winEnv).locate()
    expect(found?.args('D:\\a;b')).toEqual(['-d', 'D:\\a\\;b'])
  })

  it('falls back to Windows PowerShell, then cmd, started in the directory as cwd', async () => {
    const ps = await machine('win32', [powershell, winEnv.ComSpec], winEnv).locate()
    expect(ps).toMatchObject({ name: 'Windows PowerShell', path: powershell })
    expect(ps?.args('D:\\code')).toEqual(['-NoLogo'])

    const cmd = await machine('win32', [winEnv.ComSpec], winEnv).locate()
    expect(cmd).toMatchObject({ name: '命令提示符', path: winEnv.ComSpec })
    expect(cmd?.args('D:\\code')).toEqual([])
  })

  it('finds nothing on an empty machine', async () => {
    await expect(machine('win32', [], winEnv).locate()).resolves.toBeNull()
  })
})

describe('terminal locator on Linux', () => {
  const env = { PATH: '/usr/local/bin:/usr/bin' }

  it("prefers the distribution's default terminal", async () => {
    const found = await machine(
      'linux',
      ['/usr/bin/x-terminal-emulator', '/usr/bin/gnome-terminal'],
      env
    ).locate()
    expect(found).toMatchObject({ name: '默认终端', path: '/usr/bin/x-terminal-emulator' })
    expect(found?.args('/home/me/web')).toEqual([])
  })

  it.each([
    ['gnome-terminal', ['--working-directory=/home/me/web']],
    ['konsole', ['--workdir', '/home/me/web']],
    ['xfce4-terminal', ['--working-directory=/home/me/web']],
    ['kitty', ['--directory', '/home/me/web']],
    ['alacritty', ['--working-directory', '/home/me/web']],
    ['xterm', []]
  ])('passes the directory to %s', async (program, args) => {
    const found = await machine('linux', [`/usr/bin/${program}`], env).locate()
    expect(found?.path).toBe(`/usr/bin/${program}`)
    expect(found?.args('/home/me/web')).toEqual(args)
  })

  it('finds nothing without a known terminal', async () => {
    await expect(machine('linux', ['/usr/bin/bash'], env).locate()).resolves.toBeNull()
  })
})

it('does not look for terminals on other platforms', async () => {
  await expect(
    machine('darwin', ['/usr/bin/xterm'], { PATH: '/usr/bin' }).locate()
  ).resolves.toBeNull()
})
