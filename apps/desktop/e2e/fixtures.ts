import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import type { DevhubApi } from '@devhub/shared'
import { closeRunningApps, trackAppDiagnostics } from './diagnostics'

export { expect } from '@playwright/test'

// The app directory, not out/main/index.js: given a bare script, Electron finds no package.json
// and reports its own version and name. Its "main" points at the same built entry.
const appDir = resolve(__dirname, '..')

export interface DevhubApp {
  app: ElectronApplication
  page: Page
}

interface Fixtures {
  /** Per-test scratch directory holding DevHub's userData and the fixture projects. */
  workDir: string
  /** Launches DevHub on the test's own userData; call again after `app.close()` to restart. */
  launchDevhub: () => Promise<DevhubApp>
  /** Creates a project directory with the given files and returns its absolute path. */
  createProject: (name: string, files: Record<string, string>) => Promise<string>
}

export const test = base.extend<Fixtures>({
  // Playwright fixtures receive `use` as their last argument; it is not a React hook.
  workDir: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'devhub-e2e-'))
    await use(dir)
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  },

  launchDevhub: async ({ workDir }, use, testInfo) => {
    const launched: ElectronApplication[] = []
    const children: ReturnType<ElectronApplication['process']>[] = []
    const diagnostics: (() => Promise<void>)[] = []
    await use(async () => {
      const app = await electron.launch({
        args: [
          appDir,
          // A private profile: isolates projects.json and the single-instance lock from any
          // DevHub the developer is running.
          `--user-data-dir=${join(workDir, 'userdata')}`,
          // GitHub's Ubuntu runners cannot set up Chromium's SUID sandbox.
          ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])
        ],
        env: electronEnv()
      })
      launched.push(app)
      children.push(app.process())
      diagnostics.push(trackAppDiagnostics(app, testInfo, launched.length - 1))
      await app.context().tracing.start({ screenshots: true, snapshots: true })
      const page = await app.firstWindow()
      await page.waitForLoadState('domcontentloaded')
      // WebGL draws terminal text on a canvas that tests cannot read; use the DOM renderer.
      await page.evaluate(() => localStorage.setItem('devhub.terminalRenderer', 'dom'))
      return { app, page }
    })

    for (const [index, app] of launched.entries()) {
      const failed = testInfo.status !== testInfo.expectedStatus
      if (failed) {
        await diagnostics[index]?.().catch((error: unknown) => {
          console.error('Unable to save Electron test diagnostics', error)
        })
      }
      try {
        await app
          .context()
          .tracing.stop(failed ? { path: testInfo.outputPath(`trace-${index}.zip`) } : undefined)
      } catch {
        // Restart and quit tests have already destroyed the application's context.
      }
    }
    // Closing quits DevHub, which stops every run it started. Attempt every instance,
    // including when an earlier close rejects; report those failures after cleanup.
    await closeRunningApps(
      launched.flatMap((app, index) => {
        const child = children[index]
        return child ? [{ app, child }] : []
      })
    )
  },

  createProject: async ({ workDir }, use) => {
    await use(async (name, files) => {
      const dir = join(workDir, 'projects', name)
      for (const [file, content] of Object.entries(files)) {
        const path = join(dir, file)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, content)
      }
      await mkdir(dir, { recursive: true })
      return dir
    })
  }
})

/** Makes the next native folder picker return `path` instead of opening a dialog. */
export async function stubFolderPicker(app: ElectronApplication, path: string): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    Object.assign(dialog, {
      showOpenDialog: async () => ({ canceled: false, filePaths: [picked] })
    })
  }, path)
}

/** Registers a project through the API (for tests that are not about adding projects). */
export async function addProjectViaApi(page: Page, path: string): Promise<void> {
  // page.evaluate serializes the callback, so it cannot call helpers from this module.
  await page.evaluate((dir) => (window as unknown as DevhubWindow).devhub.addProject(dir), path)
  await page.reload()
}

/** Shape of the renderer's global, for use inside `page.evaluate` callbacks. */
export interface DevhubWindow {
  devhub: DevhubApi
}

/** A package.json whose scripts run through npm (always available next to Node). */
export const packageJson = (scripts: Record<string, string>): string =>
  JSON.stringify({ name: 'fixture', scripts }, null, 2)

/** VS Code terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node. */
function electronEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
  }
  return env
}
