import { _electron as electron } from '@playwright/test'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '../../desktop')
const outputPath = resolve(__dirname, '../resources/web-reference.png')

async function run() {
  console.log('Launching Electron to capture 1280x800 reference image...')
  const app = await electron.launch({
    args: [appDir],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY || ':0'
    }
  })

  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(2000)

  await page.screenshot({ path: outputPath })
  console.log('Saved reference screenshot to:', outputPath)
  await app.close()
}

run().catch((err) => {
  console.error('Failed to capture:', err)
  process.exit(1)
})
