import { join } from 'path'
import { z } from 'zod'
import type { Script } from '@devhub/shared'
import { exists, readOptionalFile } from './fs-utils'
import type { ScriptDetector } from './types'

const packageManagerSchema = z.enum(['npm', 'pnpm', 'yarn'])
export type PackageManager = z.infer<typeof packageManagerSchema>

// Loose on purpose: a single odd entry (e.g. a non-string script) must not hide the others.
const packageJsonSchema = z.object({
  scripts: z.record(z.string(), z.unknown()).optional(),
  packageManager: z.unknown().optional()
})

// Checked in order; the first lockfile found wins.
const lockfiles: [file: string, manager: PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm']
]

// Script names that are safe to pass unquoted to both cmd.exe and POSIX shells.
const safeName = /^[\w:.@/+=-]+$/

export const npmDetector: ScriptDetector = {
  source: 'npm',

  async detect(dir) {
    const raw = await readOptionalFile(join(dir, 'package.json'))
    if (raw === null) return []

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      throw new Error('package.json 不是有效的 JSON')
    }
    const parsed = packageJsonSchema.safeParse(json)
    if (!parsed.success) throw new Error('package.json 格式不正确')

    const manager = await detectPackageManager(dir, parsed.data.packageManager)
    const scripts: Script[] = []
    for (const [name, body] of Object.entries(parsed.data.scripts ?? {})) {
      if (typeof body !== 'string' || name.length === 0) continue
      scripts.push({
        id: `npm:${name}`,
        name,
        source: 'npm',
        command: `${manager} run ${safeName.test(name) ? name : JSON.stringify(name)}`,
        ...(body.trim() ? { description: body } : {})
      })
    }
    return scripts
  }
}

/** `packageManager` (corepack) beats lockfiles; npm is the fallback. */
export async function detectPackageManager(
  dir: string,
  packageManagerField: unknown
): Promise<PackageManager> {
  // Format is "<name>@<version>", e.g. "pnpm@9.1.0".
  if (typeof packageManagerField === 'string') {
    const declared = packageManagerSchema.safeParse(packageManagerField.split('@')[0])
    if (declared.success) return declared.data
  }
  for (const [file, manager] of lockfiles) {
    if (await exists(join(dir, file))) return manager
  }
  return 'npm'
}
