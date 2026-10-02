import { describe, expect, it } from 'vitest'
import { shellInvocation } from './pty'

describe('shellInvocation', () => {
  it('runs through cmd.exe on Windows, keeping inner quotes verbatim', () => {
    expect(shellInvocation('npm run "start dev"', 'win32', {})).toEqual({
      file: 'cmd.exe',
      args: '/d /s /c "npm run "start dev""'
    })
  })

  it('honours ComSpec on Windows', () => {
    expect(shellInvocation('dir', 'win32', { ComSpec: 'C:\\Windows\\cmd.exe' }).file).toBe(
      'C:\\Windows\\cmd.exe'
    )
  })

  it("uses the user's login shell on Linux", () => {
    expect(shellInvocation('./mvnw package', 'linux', { SHELL: '/bin/zsh' })).toEqual({
      file: '/bin/zsh',
      args: ['-lc', './mvnw package']
    })
  })

  it('falls back to /bin/sh when SHELL is unset', () => {
    expect(shellInvocation('ls', 'linux', {}).file).toBe('/bin/sh')
  })
})
