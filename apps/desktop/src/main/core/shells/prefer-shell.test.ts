import { describe, expect, it } from 'vitest'
import type { ShellSpec } from './shell-locator'
import { preferShell, withPreferredShell } from './prefer-shell'

const shell = (id: ShellSpec['id']): ShellSpec => ({
  id,
  name: id,
  file: `/bin/${id}`,
  args: [],
  env: {}
})
const ids = (shells: ShellSpec[]) => shells.map((s) => s.id)

describe('preferShell', () => {
  const installed = [shell('bash'), shell('zsh'), shell('sh')]

  it('moves the preferred shell first, keeping the rest in order', () => {
    expect(ids(preferShell(installed, 'sh'))).toEqual(['sh', 'bash', 'zsh'])
  })

  it.each([[null], ['fish' as const], ['bash' as const]])('keeps the order for %s', (preferred) => {
    expect(ids(preferShell(installed, preferred))).toEqual(['bash', 'zsh', 'sh'])
  })
})

describe('withPreferredShell', () => {
  it('reads the preference on every list, so a changed setting applies at once', async () => {
    let preferred: ShellSpec['id'] | null = null
    const locator = withPreferredShell(
      { list: async () => [shell('bash'), shell('zsh')], prepare: async () => undefined },
      async () => preferred
    )
    expect(ids(await locator.list())).toEqual(['bash', 'zsh'])
    preferred = 'zsh'
    expect(ids(await locator.list())).toEqual(['zsh', 'bash'])
  })
})
