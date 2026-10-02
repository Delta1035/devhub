import { describe, expect, it } from 'vitest'
import { buildLaunchSpec } from './editor-launch'

const env = { PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', ComSpec: 'C:\\Windows\\cmd.exe' }

describe('buildLaunchSpec', () => {
  it('starts an executable directly with the project directory as its argument', () => {
    expect(
      buildLaunchSpec({ kind: 'executable', path: 'D:\\VS Code\\Code.exe' }, 'D:\\my app', env)
    ).toEqual({
      file: 'D:\\VS Code\\Code.exe',
      args: ['D:\\my app'],
      windowsVerbatimArguments: false,
      windowsHide: false,
      env: { PATH: '/bin', ComSpec: 'C:\\Windows\\cmd.exe' }
    })
  })

  it('runs a batch launcher through cmd with both paths quoted and the console hidden', () => {
    const spec = buildLaunchSpec(
      { kind: 'batch', path: 'C:\\Toolbox scripts\\idea.cmd' },
      'D:\\my app',
      env
    )
    expect(spec).toMatchObject({
      file: 'C:\\Windows\\cmd.exe',
      args: ['/d', '/s', '/c', '""C:\\Toolbox scripts\\idea.cmd" "D:\\my app""'],
      windowsVerbatimArguments: true,
      windowsHide: true
    })
  })

  it('never passes ELECTRON_RUN_AS_NODE to the editor', () => {
    const spec = buildLaunchSpec({ kind: 'executable', path: '/usr/bin/code' }, '/repo', env)
    expect(spec.env).not.toHaveProperty('ELECTRON_RUN_AS_NODE')
  })
})
