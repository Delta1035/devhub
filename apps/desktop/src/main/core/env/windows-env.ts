export interface RegistryValue {
  name: string
  type: 'REG_SZ' | 'REG_EXPAND_SZ'
  data: string
}

const valueLine = /^ {4}(.+?) {4}(REG_SZ|REG_EXPAND_SZ)(?: {4}(.*))?$/

/** String values of one key from `reg query <key>` output; other value types are skipped. */
export function parseRegistryValues(output: string): RegistryValue[] {
  const values: RegistryValue[] = []
  let keys = 0
  for (const line of output.split(/\r?\n/)) {
    // The first header is the key itself; any later one starts a subkey listing.
    if (line.startsWith('HKEY_')) {
      if (++keys > 1) break
      continue
    }
    const match = valueLine.exec(line)
    if (match?.[1] && match[2]) {
      values.push({
        name: match[1],
        type: match[2] === 'REG_SZ' ? 'REG_SZ' : 'REG_EXPAND_SZ',
        data: match[3] ?? ''
      })
    }
  }
  return values
}

const isPathName = (name: string): boolean => name.toLowerCase() === 'path'
const unexpanded = /%[^%;]+%/

/**
 * DevHub's environment repaired with the persistent variables from the registry, so tools
 * work even when whoever started DevHub passed a broken or outdated environment (Explorer
 * can leave `%NVM_HOME%` unexpanded in PATH; tools installed later are missing).
 *
 * - PATH keeps DevHub's own entries first, with `%VAR%` references expanded, then adds the
 *   registry's machine and user entries it lacks. Entries that still hold an unexpanded
 *   reference point nowhere and are dropped.
 * - Other variables are only added when DevHub's environment lacks them.
 *
 * Unlike Windows, references are expanded however the registry stores them: a `REG_SZ`
 * PATH or a `REG_EXPAND_SZ` variable referring to another one is a common breakage, and a
 * directory literally named `%NVM_HOME%` is not something to preserve.
 */
export function windowsLaunchEnv(
  processEnv: Record<string, string>,
  machine: RegistryValue[],
  user: RegistryValue[]
): Record<string, string> {
  // User values override machine ones, except PATH: machine entries, then user entries.
  const registry = new Map<string, RegistryValue>()
  const registryPaths: string[] = []
  for (const value of [...machine, ...user]) {
    if (isPathName(value.name)) registryPaths.push(value.data)
    else registry.set(value.name.toLowerCase(), value)
  }
  const processKeys = new Map(Object.keys(processEnv).map((key) => [key.toLowerCase(), key]))

  const lookup = (name: string, seen: ReadonlySet<string>): string | undefined => {
    const key = name.toLowerCase()
    const processKey = processKeys.get(key)
    if (processKey !== undefined) return processEnv[processKey]
    const value = registry.get(key)
    if (!value) return undefined
    return value.type === 'REG_EXPAND_SZ' ? expand(value.data, new Set([...seen, key])) : value.data
  }
  // `seen` stops variables that refer to each other; the reference is then left as is.
  const expand = (text: string, seen: ReadonlySet<string> = new Set()): string =>
    text.replace(/%([^%;]+)%/g, (reference, name: string) =>
      seen.has(name.toLowerCase()) ? reference : (lookup(name, seen) ?? reference)
    )

  const result = { ...processEnv }
  for (const [key, value] of registry) {
    if (!processKeys.has(key)) {
      result[value.name] =
        value.type === 'REG_EXPAND_SZ' ? expand(value.data, new Set([key])) : value.data
    }
  }
  const pathKey = processKeys.get('path') ?? 'Path'
  result[pathKey] = mergePath(
    [processEnv[pathKey] ?? '', ...registryPaths]
      .flatMap((list) => list.split(';'))
      .map((entry) => expand(entry))
  )
  return result
}

/** Joins PATH entries without blanks, dead references or duplicates (first spelling wins). */
function mergePath(entries: string[]): string {
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of entries) {
    const entry = raw.trim()
    if (!entry || unexpanded.test(entry)) continue
    const key = entry.replace(/[\\/]+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(entry)
  }
  return kept.join(';')
}
