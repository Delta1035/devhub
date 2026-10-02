// Regenerates every app icon (PNG / ICO / ICNS / web) from the SVG sources in build/.
// Usage: pnpm --filter @devhub/desktop icons
//
// Rendering uses an offscreen Electron window, so no extra image tooling is needed on
// Windows or Linux. Started with plain node, the script re-launches itself inside Electron.
import { spawn } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = join(dirname(scriptPath), '..')
const build = join(root, 'build')
const resources = join(root, 'resources')
const web = join(root, 'src', 'renderer', 'public')

// Sources: icon.svg (rounded, full size), icon-mac.svg (Apple 824/1024 grid),
// icon-square.svg (full-bleed, for platforms that apply their own mask), tray-template.svg.
const pngs = [
  { src: 'icon.svg', size: 512, out: join(build, 'icon.png') },
  { src: 'icon.svg', size: 512, out: join(resources, 'icon.png') },
  { src: 'icon.svg', size: 16, out: join(resources, 'tray.png') },
  { src: 'icon.svg', size: 32, out: join(resources, 'tray@2x.png') },
  { src: 'tray-template.svg', size: 16, out: join(resources, 'trayTemplate.png') },
  { src: 'tray-template.svg', size: 32, out: join(resources, 'trayTemplate@2x.png') },
  { src: 'icon.svg', size: 192, out: join(web, 'icon-192.png') },
  { src: 'icon.svg', size: 512, out: join(web, 'icon-512.png') },
  { src: 'icon-square.svg', size: 512, out: join(web, 'icon-maskable-512.png') },
  { src: 'icon-square.svg', size: 180, out: join(web, 'apple-touch-icon.png') }
]
const icos = [
  { src: 'icon.svg', sizes: [16, 24, 32, 48, 64, 128, 256], out: join(build, 'icon.ico') },
  { src: 'icon.svg', sizes: [16, 32, 48], out: join(web, 'favicon.ico') }
]
// ICNS entry types; the retina (@2x) types reuse the pixel size of the larger entry.
const icnsTypes = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512]
]

function packIco(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length + 16 * images.length
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    // 0 means 256 in the one-byte width/height fields.
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)])
}

function packIcns(entries) {
  const chunks = entries.map(({ type, png }) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

async function createRenderer() {
  const { app, BrowserWindow } = await import('electron')
  app.disableHardwareAcceleration()
  await app.whenReady()
  const window = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    frame: false,
    transparent: true,
    // Hidden windows are throttled by default, which would stall requestAnimationFrame.
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  await window.loadURL(
    'data:text/html,<body style="margin:0;background:transparent"><img id="i" style="display:block"></body>'
  )
  const svgCache = new Map()

  async function render(src, size) {
    if (!svgCache.has(src)) {
      const svg = await readFile(join(build, src))
      svgCache.set(src, `data:image/svg+xml;base64,${svg.toString('base64')}`)
    }
    await window.webContents.executeJavaScript(`(async () => {
      const img = document.getElementById('i')
      img.width = ${size}
      img.height = ${size}
      img.src = ${JSON.stringify(svgCache.get(src))}
      await img.decode()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    })()`)
    let image = await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
    // Guard against a display scale factor other than 1.
    if (image.getSize().width !== size) image = image.resize({ width: size, quality: 'best' })
    return image.toPNG()
  }

  return { render, close: () => app.exit(0), fail: () => app.exit(1) }
}

async function generate(render) {
  await mkdir(web, { recursive: true })
  for (const { src, size, out } of pngs) {
    await writeFile(out, await render(src, size))
  }
  for (const { src, sizes, out } of icos) {
    const images = []
    for (const size of sizes) images.push({ size, png: await render(src, size) })
    await writeFile(out, packIco(images))
  }
  const icns = []
  for (const [type, size] of icnsTypes) icns.push({ type, png: await render('icon-mac.svg', size) })
  await writeFile(join(build, 'icon.icns'), packIcns(icns))
  await copyFile(join(build, 'icon.svg'), join(web, 'favicon.svg'))
  console.log(`Generated ${pngs.length + icos.length + 2} icon files.`)
}

if (process.versions.electron) {
  // No top-level await here: Electron only emits 'ready' once the ESM entry has finished
  // evaluating, so awaiting app.whenReady() at the top level would deadlock.
  createRenderer().then(async (renderer) => {
    try {
      await generate(renderer.render)
      renderer.close()
    } catch (error) {
      console.error(error)
      renderer.fail()
    }
  })
} else {
  // Under plain node, importing 'electron' yields the binary path. VSCode terminals set
  // ELECTRON_RUN_AS_NODE, which would stop Electron from starting as an app.
  const { default: electronPath } = await import('electron')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  spawn(electronPath, [scriptPath], { stdio: 'inherit', env }).on('exit', (code) =>
    process.exit(code ?? 1)
  )
}
