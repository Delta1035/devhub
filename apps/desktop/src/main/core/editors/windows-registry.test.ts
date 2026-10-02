import { describe, expect, it } from 'vitest'
import { parseJetBrainsInstallDirs } from './windows-registry'

// Real shape of `reg query HKLM\SOFTWARE\JetBrains /s` (CRLF, localized default-value name).
const output = [
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA\\241.14494.240',
  '    (默认)    REG_SZ    C:\\Program Files\\JetBrains\\IntelliJ IDEA 2024.1',
  '    MenuFolder    REG_SZ    JetBrains',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA\\262.10968.92',
  '    (Default)    REG_SZ    D:\\software\\IntelliJ IDEA 2026.2',
  '    AssociationKey    REG_SZ    IntelliJIdea2026.2',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\IntelliJ IDEA Community Edition\\243.1.1',
  '    (Default)    REG_SZ    D:\\tools\\IDEA Community',
  '',
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\JetBrains\\PyCharm\\262.10968.92',
  '    (默认)    REG_SZ    D:\\software\\pycharm\\PyCharm 2026.2.3',
  ''
].join('\r\n')

describe('parseJetBrainsInstallDirs', () => {
  it('returns install dirs of matching products, newest build first', () => {
    expect(parseJetBrainsInstallDirs(output, 'IntelliJ IDEA')).toEqual([
      'D:\\software\\IntelliJ IDEA 2026.2',
      'D:\\tools\\IDEA Community',
      'C:\\Program Files\\JetBrains\\IntelliJ IDEA 2024.1'
    ])
  })

  it('ignores other products and non-default values', () => {
    expect(parseJetBrainsInstallDirs(output, 'PyCharm')).toEqual([
      'D:\\software\\pycharm\\PyCharm 2026.2.3'
    ])
  })

  it('returns nothing for empty output (key missing)', () => {
    expect(parseJetBrainsInstallDirs('', 'IntelliJ IDEA')).toEqual([])
  })
})
