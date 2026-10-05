/** Variables describing the capturing shell itself rather than the user's environment. */
const shellOwn = new Set(['PWD', 'OLDPWD', 'SHLVL', '_'])

/**
 * The command run in the user's interactive login shell to print its environment. The
 * marker (hex only, safe inside single quotes) separates it from whatever the startup files
 * print themselves; `env -0` keeps values containing newlines intact.
 */
export function shellEnvCommand(marker: string): string {
  return `printf '%s' '${marker}'; env -0; printf '%s' '${marker}'`
}

/** The environment between the markers, or null when the output does not contain it. */
export function parseShellEnv(stdout: string, marker: string): Record<string, string> | null {
  const start = stdout.indexOf(marker)
  const end = start === -1 ? -1 : stdout.indexOf(marker, start + marker.length)
  if (end === -1) return null

  const env: Record<string, string> = {}
  for (const entry of stdout.slice(start + marker.length, end).split('\0')) {
    const separator = entry.indexOf('=')
    if (separator <= 0) continue
    const name = entry.slice(0, separator)
    if (!shellOwn.has(name)) env[name] = entry.slice(separator + 1)
  }
  // Every real shell has PATH; without it the output was something else.
  return env.PATH === undefined ? null : env
}
