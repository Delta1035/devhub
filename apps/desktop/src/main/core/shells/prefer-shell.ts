import type { ShellId } from '@devhub/shared'
import type { ShellLocator, ShellSpec } from './shell-locator'

/** Moves the preferred shell to the front; unknown or missing ids leave the order alone. */
export function preferShell(shells: ShellSpec[], preferred: ShellId | null): ShellSpec[] {
  const index = shells.findIndex((shell) => shell.id === preferred)
  if (index <= 0) return shells
  return [shells[index]!, ...shells.slice(0, index), ...shells.slice(index + 1)]
}

/** A locator whose first shell (the default) follows the user's setting. */
export function withPreferredShell(
  locator: ShellLocator,
  preferred: () => Promise<ShellId | null>
): ShellLocator {
  return {
    list: async () => preferShell(await locator.list(), await preferred()),
    prepare: (shell) => locator.prepare(shell)
  }
}
