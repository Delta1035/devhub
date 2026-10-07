import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, verify } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { inflateRawSync } from 'node:zlib'
import { buildBundle, createZip, listFiles, versionCode } from './live-update-bundle.mjs'

/** Reads entries back through the central directory, as unzip tools do. */
function readZip(zip) {
  const end = zip.length - 22
  assert.equal(zip.readUInt32LE(end), 0x06054b50)
  const count = zip.readUInt16LE(end + 10)
  let at = zip.readUInt32LE(end + 16)
  const entries = {}
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50)
    const size = zip.readUInt32LE(at + 20)
    const nameLength = zip.readUInt16LE(at + 28)
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8')
    const local = zip.readUInt32LE(at + 42)
    assert.equal(zip.readUInt32LE(local), 0x04034b50)
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    entries[name] = inflateRawSync(zip.subarray(dataStart, dataStart + size))
    at += 46 + nameLength
  }
  return entries
}

describe('live update bundle', () => {
  const dirs = []
  afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })))

  const webDir = () => {
    const dir = mkdtempSync(join(tmpdir(), 'devhub-web-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>DevHub</title>')
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("中文")\n'.repeat(50))
    return dir
  }

  it('lists files with forward slashes, sorted', () => {
    assert.deepEqual(listFiles(webDir()), ['assets/app.js', 'index.html'])
  })

  it('zips the web build so it unpacks to the same files', () => {
    const dir = webDir()
    const zip = createZip(
      listFiles(dir).map((name) => ({ name, data: Buffer.from(`content of ${name}`) }))
    )
    assert.deepEqual(
      Object.fromEntries(Object.entries(readZip(zip)).map(([name, data]) => [name, String(data)])),
      { 'assets/app.js': 'content of assets/app.js', 'index.html': 'content of index.html' }
    )
  })

  it('writes a manifest whose checksum and signature match the zip', () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
    const { zip, bundle, manifest, manifestName } = buildBundle({
      webDir: webDir(),
      version: '1.4.0',
      minVersionCode: 10400,
      privateKey: pem
    })
    assert.equal(bundle, 'devhub-web-1.4.0.zip')
    assert.equal(manifestName, 'devhub-web-1.4.0.json')
    assert.equal(manifest.version, '1.4.0')
    assert.equal(manifest.minVersionCode, 10400)
    assert.equal(manifest.bundle, bundle)
    assert.equal(manifest.checksum, createHash('sha256').update(zip).digest('hex'))
    assert.ok(verify('sha256', zip, publicKey, Buffer.from(manifest.signature, 'base64')))
    assert.ok(
      !verify(
        'sha256',
        Buffer.concat([zip, Buffer.from('x')]),
        publicKey,
        Buffer.from(manifest.signature, 'base64')
      )
    )
    assert.equal(String(readZip(zip)['index.html']), '<!doctype html><title>DevHub</title>')
  })

  it('produces the same bytes for the same input', () => {
    const dir = webDir()
    const files = () => listFiles(dir).map((name) => ({ name, data: Buffer.from(name) }))
    assert.deepEqual(createZip(files()), createZip(files()))
  })

  it('computes versionCode as the Gradle build does', () => {
    assert.equal(versionCode('1.3.0'), 10300)
    assert.equal(versionCode('2.10.7'), 21007)
  })
})
