import { describe, expect, it } from 'vitest'
import type { CustomShell } from '@devhub/shared'
import { withCustomShells } from './custom-shells'
import type { ShellSpec } from './shell-locator'

const bash: ShellSpec = { id: 'bash', name: 'bash', file: '/bin/bash', args: ['-l'], env: {} }
const nu: CustomShell = { id: 'custom-nu', name: 'Nushell', path: '/opt/nu', args: ['--login'] }
const gone: CustomShell = { id: 'custom-old', name: 'Old', path: '/removed', args: [] }

describe('withCustomShells', () => {
  it('appends custom shells whose program still exists', async () => {
    const locator = withCustomShells(
      { list: async () => [bash], prepare: async () => undefined },
      async () => [nu, gone],
      async (path) => path === '/opt/nu'
    )
    await expect(locator.list()).resolves.toEqual([
      bash,
      { id: 'custom-nu', name: 'Nushell', file: '/opt/nu', args: ['--login'], env: {} }
    ])
  })
})
