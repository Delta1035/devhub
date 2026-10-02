/**
 * Extracts install directories from `reg query <root>\SOFTWARE\JetBrains /s` output.
 * JetBrains installers write `...\JetBrains\<Product>\<build>` whose default value is the
 * install directory. The default value's name is localized ("(Default)", "(默认)" …), so it
 * is matched as "any name in parentheses".
 *
 * Returns directories of products whose key name starts with `productPrefix`, newest build
 * first.
 */
export function parseJetBrainsInstallDirs(output: string, productPrefix: string): string[] {
  const found: { build: number[]; dir: string }[] = []
  let current: { product: string; build: number[] } | null = null

  for (const line of output.split(/\r?\n/)) {
    const key = /\\JetBrains\\([^\\]+)\\([^\\]+)$/i.exec(line.trim())
    if (key?.[1] && key[2]) {
      current = { product: key[1], build: key[2].split('.').map(Number) }
      continue
    }
    if (line.startsWith('HKEY_')) {
      current = null
      continue
    }
    const value = /^\s+\(.*\)\s+REG_SZ\s+(.+?)\s*$/.exec(line)
    if (current && value?.[1] && current.product.startsWith(productPrefix)) {
      found.push({ build: current.build, dir: value[1] })
    }
  }

  return found.sort((a, b) => compareBuilds(b.build, a.build)).map((entry) => entry.dir)
}

function compareBuilds(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0 && !Number.isNaN(diff)) return diff
  }
  return 0
}
