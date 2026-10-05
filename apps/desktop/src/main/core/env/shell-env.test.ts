import { describe, expect, it } from 'vitest'
import { parseShellEnv, shellEnvCommand } from './shell-env'

const marker = '__DEVHUB_ENV_0123abcd__'

describe('shellEnvCommand', () => {
  it('prints the environment between two markers', () => {
    expect(shellEnvCommand(marker)).toBe(`printf '%s' '${marker}'; env -0; printf '%s' '${marker}'`)
  })
})

describe('parseShellEnv', () => {
  const env = (entries: string[]): string => entries.join('\0') + '\0'

  it('reads the environment and ignores what startup files print around it', () => {
    const stdout =
      'Welcome! nvm is loaded\n' +
      marker +
      env([
        'PATH=/home/u/.nvm/versions/node/v24/bin:/usr/bin',
        'NVM_DIR=/home/u/.nvm',
        'MULTI=line one\nline two',
        'EQUALS=a=b',
        'PWD=/home/u',
        'OLDPWD=/tmp',
        'SHLVL=2',
        '_=/usr/bin/env'
      ]) +
      marker +
      'bye\n'
    expect(parseShellEnv(stdout, marker)).toEqual({
      PATH: '/home/u/.nvm/versions/node/v24/bin:/usr/bin',
      NVM_DIR: '/home/u/.nvm',
      MULTI: 'line one\nline two',
      EQUALS: 'a=b'
    })
  })

  it.each([
    ['no markers', 'bash: env: command not found\n'],
    ['one marker', `${marker}PATH=/usr/bin\0`],
    ['no PATH', `${marker}${env(['HOME=/home/u'])}${marker}`],
    ['empty', '']
  ])('returns null for output with %s', (_, stdout) => {
    expect(parseShellEnv(stdout, marker)).toBeNull()
  })
})
