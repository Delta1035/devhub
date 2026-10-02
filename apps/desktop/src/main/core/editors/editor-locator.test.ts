import { describe, expect, it } from 'vitest'
import { createEditorLocator, type EditorLocatorDeps } from './editor-locator'

/** A fake machine: a set of existing files, directory listings and registry output. */
const machine = (
  platform: NodeJS.Platform,
  files: string[],
  options: {
    env?: NodeJS.ProcessEnv
    dirs?: Record<string, string[]>
    registry?: Record<string, string>
  } = {}
) => {
  const deps: EditorLocatorDeps = {
    platform,
    env: options.env ?? {},
    exists: async (path) => files.includes(path),
    listDir: async (path) => options.dirs?.[path] ?? [],
    queryRegistry: async (key) => options.registry?.[key] ?? ''
  }
  return createEditorLocator(deps)
}

const winEnv = {
  PATH: 'C:\\Windows;D:\\software\\Microsoft VS Code\\bin',
  PATHEXT: '.COM;.EXE;.BAT;.CMD',
  LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
  ProgramFiles: 'C:\\Program Files'
}

describe('editor locator on Windows', () => {
  it('finds VS Code through the code CLI on PATH and prefers the Code.exe next to it', async () => {
    const locator = machine(
      'win32',
      [
        'D:\\software\\Microsoft VS Code\\bin\\code.cmd',
        'D:\\software\\Microsoft VS Code\\Code.exe'
      ],
      { env: winEnv }
    )
    await expect(locator.locate('vscode')).resolves.toEqual({
      kind: 'executable',
      path: 'D:\\software\\Microsoft VS Code\\Code.exe'
    })
  })

  it('falls back to the code.cmd CLI when Code.exe is not where expected', async () => {
    const locator = machine('win32', ['D:\\software\\Microsoft VS Code\\bin\\code.cmd'], {
      env: winEnv
    })
    await expect(locator.locate('vscode')).resolves.toEqual({
      kind: 'batch',
      path: 'D:\\software\\Microsoft VS Code\\bin\\code.cmd'
    })
  })

  it('finds a per-user VS Code install that is not on PATH', async () => {
    const exe = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'
    const locator = machine('win32', [exe], { env: { ...winEnv, PATH: 'C:\\Windows' } })
    await expect(locator.locate('vscode')).resolves.toEqual({ kind: 'executable', path: exe })
  })

  it('finds IntelliJ IDEA in a custom directory through the registry', async () => {
    const exe = 'D:\\software\\IntelliJ IDEA 2026.2\\bin\\idea64.exe'
    const locator = machine('win32', [exe], {
      env: winEnv,
      registry: {
        'HKLM\\SOFTWARE\\JetBrains': [
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA\\262.1',
          '    (默认)    REG_SZ    D:\\software\\IntelliJ IDEA 2026.2'
        ].join('\r\n')
      }
    })
    await expect(locator.locate('idea')).resolves.toEqual({ kind: 'executable', path: exe })
  })

  it('uses the Toolbox launcher script as a batch file', async () => {
    const script = 'C:\\Users\\me\\AppData\\Local\\JetBrains\\Toolbox\\scripts\\idea.cmd'
    const locator = machine('win32', [script], { env: winEnv })
    await expect(locator.locate('idea')).resolves.toEqual({ kind: 'batch', path: script })
  })

  it('picks the newest versioned install under Program Files', async () => {
    const newest = 'C:\\Program Files\\JetBrains\\IntelliJ IDEA 2025.3\\bin\\idea64.exe'
    const locator = machine(
      'win32',
      ['C:\\Program Files\\JetBrains\\IntelliJ IDEA 2024.1\\bin\\idea64.exe', newest],
      {
        env: winEnv,
        dirs: {
          'C:\\Program Files\\JetBrains': [
            'IntelliJ IDEA 2024.1',
            'PyCharm 2026.2',
            'IntelliJ IDEA 2025.3'
          ]
        }
      }
    )
    await expect(locator.locate('idea')).resolves.toEqual({ kind: 'executable', path: newest })
  })

  it('prefers PATH over the registry', async () => {
    const onPath = 'C:\\Windows\\idea64.exe'
    const locator = machine('win32', [onPath, 'D:\\other\\bin\\idea64.exe'], {
      env: winEnv,
      registry: {
        'HKLM\\SOFTWARE\\JetBrains':
          'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA\\1\r\n    (Default)    REG_SZ    D:\\other'
      }
    })
    await expect(locator.locate('idea')).resolves.toEqual({ kind: 'executable', path: onPath })
  })

  it('returns null when nothing is installed', async () => {
    const locator = machine('win32', [], { env: winEnv })
    await expect(locator.locate('vscode')).resolves.toBeNull()
    await expect(locator.locate('idea')).resolves.toBeNull()
  })
})

describe('editor locator on Linux', () => {
  const linuxEnv = { PATH: '/usr/local/bin:/usr/bin', HOME: '/home/me' }

  it('finds VS Code on PATH', async () => {
    const locator = machine('linux', ['/usr/bin/code'], { env: linuxEnv })
    await expect(locator.locate('vscode')).resolves.toEqual({
      kind: 'executable',
      path: '/usr/bin/code'
    })
  })

  it('finds a snap install of VS Code', async () => {
    const locator = machine('linux', ['/snap/bin/code'], { env: linuxEnv })
    await expect(locator.locate('vscode')).resolves.toMatchObject({ path: '/snap/bin/code' })
  })

  it.each([
    ['/usr/local/bin/idea'],
    ['/usr/bin/intellij-idea-community'],
    ['/home/me/.local/share/JetBrains/Toolbox/scripts/idea'],
    ['/snap/bin/intellij-idea-ultimate']
  ])('finds IntelliJ IDEA at %s', async (path) => {
    const locator = machine('linux', [path], { env: linuxEnv })
    await expect(locator.locate('idea')).resolves.toEqual({ kind: 'executable', path })
  })

  it('never treats a Linux file as a Windows batch launcher', async () => {
    const locator = machine('linux', ['/usr/bin/idea.sh'], { env: linuxEnv })
    await expect(locator.locate('idea')).resolves.toEqual({
      kind: 'executable',
      path: '/usr/bin/idea.sh'
    })
  })
})
