import { describe, expect, it } from 'vitest'
import { parseRegistryValues, windowsLaunchEnv, type RegistryValue } from './windows-env'

const machineOutput = [
  '',
  'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment',
  '    ComSpec    REG_EXPAND_SZ    %SystemRoot%\\system32\\cmd.exe',
  '    NUMBER_OF_PROCESSORS    REG_SZ    16',
  '    Path    REG_EXPAND_SZ    %SystemRoot%\\system32;D:\\software\\Git\\cmd;%NVM_HOME%;%NVM_SYMLINK%',
  '    NVM_HOME    REG_EXPAND_SZ    C:\\Users\\delta\\AppData\\Local\\nvm',
  '    NVM_SYMLINK    REG_EXPAND_SZ    C:\\nvm4w\\nodejs',
  '    OS    REG_SZ    Windows_NT',
  '    Flags    REG_DWORD    0x1',
  '    EMPTY    REG_SZ    ',
  '',
  'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment\\Sub',
  ''
].join('\r\n')

const value = (name: string, data: string, type: RegistryValue['type'] = 'REG_EXPAND_SZ') => ({
  name,
  type,
  data
})

describe('parseRegistryValues', () => {
  it('reads the string values of the key and stops at subkeys', () => {
    expect(parseRegistryValues(machineOutput)).toEqual([
      value('ComSpec', '%SystemRoot%\\system32\\cmd.exe'),
      value('NUMBER_OF_PROCESSORS', '16', 'REG_SZ'),
      value('Path', '%SystemRoot%\\system32;D:\\software\\Git\\cmd;%NVM_HOME%;%NVM_SYMLINK%'),
      value('NVM_HOME', 'C:\\Users\\delta\\AppData\\Local\\nvm'),
      value('NVM_SYMLINK', 'C:\\nvm4w\\nodejs'),
      value('OS', 'Windows_NT', 'REG_SZ'),
      value('EMPTY', '', 'REG_SZ')
    ])
  })

  it('keeps names with spaces and non-ASCII data', () => {
    const output =
      'HKEY_CURRENT_USER\\Environment\n    IntelliJ IDEA    REG_SZ    D:\\中文\\idea\\bin;\n'
    expect(parseRegistryValues(output)).toEqual([
      value('IntelliJ IDEA', 'D:\\中文\\idea\\bin;', 'REG_SZ')
    ])
  })

  it('returns nothing for empty output', () => {
    expect(parseRegistryValues('')).toEqual([])
  })
})

describe('windowsLaunchEnv', () => {
  const machine = parseRegistryValues(machineOutput)

  // What Explorer handed DevHub after an update: the references were never expanded.
  const brokenProcessEnv = {
    Path: 'C:\\Windows\\system32;D:\\software\\Git\\cmd;%NVM_HOME%;%NVM_SYMLINK%;%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps',
    SystemRoot: 'C:\\Windows',
    USERPROFILE: 'C:\\Users\\delta',
    ComSpec: 'C:\\Windows\\system32\\cmd.exe'
  }

  it('repairs a PATH whose nvm references were left unexpanded', () => {
    // A REG_SZ user Path (Windows does not expand it) referring to REG_EXPAND_SZ variables.
    const user = [
      value('Path', '%USERPROFILE%\\.cargo\\bin;%NVM_HOME%;%NVM_SYMLINK%', 'REG_SZ'),
      value('NVM_HOME', 'C:\\Users\\delta\\AppData\\Local\\nvm'),
      value('NVM_SYMLINK', 'C:\\nvm4w\\nodejs')
    ]
    const env = windowsLaunchEnv({ ...brokenProcessEnv }, machine, user)
    expect(env.Path?.split(';')).toEqual([
      'C:\\Windows\\system32',
      'D:\\software\\Git\\cmd',
      'C:\\Users\\delta\\AppData\\Local\\nvm',
      'C:\\nvm4w\\nodejs',
      'C:\\Users\\delta\\AppData\\Local\\Microsoft\\WindowsApps',
      'C:\\Users\\delta\\.cargo\\bin'
    ])
  })

  it('expands references the inherited environment cannot resolve from the registry', () => {
    // NVM_* are missing from the inherited environment too.
    const env = windowsLaunchEnv(
      { Path: 'C:\\Windows;%NVM_SYMLINK%', SystemRoot: 'C:\\Windows' },
      machine,
      []
    )
    expect(env.Path).toBe(
      'C:\\Windows;C:\\nvm4w\\nodejs;C:\\Windows\\system32;D:\\software\\Git\\cmd;C:\\Users\\delta\\AppData\\Local\\nvm'
    )
    expect(env.NVM_SYMLINK).toBe('C:\\nvm4w\\nodejs')
  })

  it('adds tools installed after DevHub started', () => {
    const user = [value('Path', 'C:\\Program Files\\nodejs\\', 'REG_EXPAND_SZ')]
    const env = windowsLaunchEnv({ Path: 'C:\\Windows' }, [], user)
    expect(env.Path).toBe('C:\\Windows;C:\\Program Files\\nodejs\\')
  })

  it('keeps inherited entries first and drops duplicates, blanks and dead references', () => {
    const env = windowsLaunchEnv(
      { PATH: 'C:\\venv\\Scripts;;C:\\Tools\\;%NOT_DEFINED%\\bin' },
      [value('Path', 'c:\\tools;C:\\Windows;C:\\venv\\Scripts\\')],
      []
    )
    // The inherited key spelling is kept; no second Path key appears.
    expect(env).toEqual({ PATH: 'C:\\venv\\Scripts;C:\\Tools\\;C:\\Windows' })
  })

  it('adds missing variables but never overrides inherited ones', () => {
    const env = windowsLaunchEnv(
      { Path: '', JAVA_HOME: 'D:\\jdk-21', SystemRoot: 'C:\\Windows' },
      [value('JAVA_HOME', 'D:\\jdk-17'), value('ComSpec', '%SystemRoot%\\system32\\cmd.exe')],
      [value('GRADLE_HOME', '%NVM_HOME%', 'REG_SZ')]
    )
    expect(env.JAVA_HOME).toBe('D:\\jdk-21')
    expect(env.ComSpec).toBe('C:\\Windows\\system32\\cmd.exe')
    // REG_SZ values other than PATH stay literal, as Windows treats them.
    expect(env.GRADLE_HOME).toBe('%NVM_HOME%')
  })

  it('lets user values override machine ones', () => {
    const env = windowsLaunchEnv(
      { Path: '' },
      [value('TEMP', 'C:\\Windows\\Temp')],
      [value('TEMP', 'C:\\Users\\delta\\Temp')]
    )
    expect(env.TEMP).toBe('C:\\Users\\delta\\Temp')
  })

  it('leaves variables that refer to each other unexpanded', () => {
    const env = windowsLaunchEnv(
      { Path: 'C:\\Windows' },
      [value('A', '%B%\\a'), value('B', '%A%\\b'), value('Path', '%A%')],
      []
    )
    expect(env.A).toBe('%A%\\b\\a')
    expect(env.Path).toBe('C:\\Windows')
  })
})
