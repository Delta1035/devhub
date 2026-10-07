#!/usr/bin/env node
// Packs the Android app's web build for live updates (ADR 0030): `devhub-web-<version>.zip`, and
// `devhub-web-<version>.json` with its SHA-256, RSA signature and the oldest app build that can
// run it. The app verifies both with the public key in apps/mobile-capacitor/capacitor.config.ts.
//
// Usage: node scripts/live-update-bundle.mjs <out-dir>
//   LIVE_UPDATE_PRIVATE_KEY  PEM private key (the GitHub secret of the same name)
import { createHash, sign } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { crc32, deflateRawSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Every file under `dir`, as zip entry names (forward slashes), sorted for reproducible zips. */
export function listFiles(dir) {
  const files = []
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) files.push(relative(dir, path).split(sep).join('/'))
    }
  }
  walk(dir)
  return files.sort()
}

/** A deflated zip of `files` ({ name, data }), with fixed timestamps so equal input gives equal bytes. */
export function createZip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)
    // Version 2.0 needed, UTF-8 names (flag bit 11), deflate (8), DOS date 1980-01-01 00:00.
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)

    locals.push(local, nameBytes, compressed)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + compressed.length
  }
  const centralDir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralDir, end])
}

/** The Android versionCode of a version, as android/app/build.gradle computes it (ADR 0029). */
export function versionCode(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return major * 10000 + minor * 100 + patch
}

/** The zip and its manifest (`LiveUpdateManifest` in packages/shared). */
export function buildBundle({ webDir, version, minVersionCode, privateKey }) {
  const zip = createZip(
    listFiles(webDir).map((name) => ({
      name,
      data: readFileSync(join(webDir, ...name.split('/')))
    }))
  )
  const bundle = `devhub-web-${version}.zip`
  const manifest = {
    version,
    minVersionCode,
    bundle,
    checksum: createHash('sha256').update(zip).digest('hex'),
    // RSA PKCS#1 v1.5 over SHA-256: the plugin checks it with SHA256withRSA.
    signature: sign('sha256', zip, privateKey).toString('base64')
  }
  return { zip, bundle, manifest, manifestName: `devhub-web-${version}.json` }
}

function main() {
  const [outDir] = process.argv.slice(2)
  const privateKey = process.env.LIVE_UPDATE_PRIVATE_KEY
  if (!outDir || !privateKey) {
    console.error(
      'Usage: LIVE_UPDATE_PRIVATE_KEY=<pem> node scripts/live-update-bundle.mjs <out-dir>'
    )
    process.exit(2)
  }
  const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
  const version = readJson('apps/desktop/package.json').version
  const { minVersionCode } = readJson('apps/mobile-capacitor/live-update.json')
  if (minVersionCode > versionCode(version)) {
    console.error(
      `live-update.json minVersionCode ${minVersionCode} is above this release's versionCode ` +
        `${versionCode(version)}: its own APK could not run the bundle`
    )
    process.exit(1)
  }
  const { zip, bundle, manifest, manifestName } = buildBundle({
    webDir: join(root, 'apps/desktop/out/capacitor'),
    version,
    minVersionCode,
    privateKey
  })
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, bundle), zip)
  writeFileSync(join(outDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${bundle}: ${zip.length} bytes, sha256 ${manifest.checksum}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
