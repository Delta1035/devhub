import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const supportedGlibc = '2.35'

export function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

/** Finds the newest GLIBC symbol version referenced by an ELF binary. */
export function requiredGlibc(binary) {
  const versions = [...binary.matchAll(/GLIBC_(\d+\.\d+)/g)].map((match) => match[1])
  return versions.sort(compareVersions).at(-1) ?? null
}

export function verifyLinuxPackage(packageDir, maxGlibc = supportedGlibc) {
  const root = resolve(packageDir)
  const executable = join(root, 'devhub')
  const nodePty = join(
    root,
    'resources/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node'
  )
  const required = requiredGlibc(readFileSync(nodePty, 'latin1'))
  if (required === null) throw new Error(`${nodePty} does not declare a GLIBC requirement`)
  if (compareVersions(required, maxGlibc) > 0) {
    throw new Error(`${nodePty} requires GLIBC ${required}; the supported maximum is ${maxGlibc}`)
  }

  const nodePtyPackage = dirname(dirname(dirname(nodePty)))
  const statement = `require(${JSON.stringify(nodePtyPackage)}); process.stdout.write('node-pty loaded\\n')`
  const loaded = spawnSync(executable, ['-e', statement], {
    encoding: 'utf8',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
  if (loaded.error) throw loaded.error
  if (loaded.status !== 0 || loaded.stdout.trim() !== 'node-pty loaded') {
    throw new Error(
      `Packaged Electron could not load node-pty (exit ${loaded.status}): ${loaded.stderr.trim()}`
    )
  }
  return { nodePty, required }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const packageDir = process.argv[2]
  if (!packageDir) {
    console.error('Usage: node scripts/verify-linux-package.mjs <linux-unpacked-directory>')
    process.exitCode = 2
  } else {
    try {
      const result = verifyLinuxPackage(packageDir)
      console.log(`node-pty loaded; requires GLIBC ${result.required} (maximum ${supportedGlibc})`)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  }
}
