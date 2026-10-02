import type { CustomShell } from '@devhub/shared'
import type { ShellLocator } from './shell-locator'

/**
 * Adds the user's own shells after the detected ones. A shell whose program has been removed
 * since it was configured is left out rather than failing when it is opened.
 */
export function withCustomShells(
  locator: ShellLocator,
  customShells: () => Promise<CustomShell[]>,
  isFile: (path: string) => Promise<boolean>
): ShellLocator {
  return {
    async list() {
      const [detected, custom] = await Promise.all([locator.list(), customShells()])
      const available = await Promise.all(
        custom.map(async (shell) => ((await isFile(shell.path)) ? shell : null))
      )
      return [
        ...detected,
        ...available
          .filter((shell) => shell !== null)
          .map((shell) => ({
            id: shell.id,
            name: shell.name,
            file: shell.path,
            args: shell.args,
            env: {}
          }))
      ]
    },
    prepare: (shell) => locator.prepare(shell)
  }
}
