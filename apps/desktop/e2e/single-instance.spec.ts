import { execFile } from 'child_process'
import { mkdir, readlink, symlink } from 'fs/promises'
import { hostname } from 'os'
import { join, resolve } from 'path'
import { promisify } from 'util'
import { test, expect } from './fixtures'

const execFileAsync = promisify(execFile)
const appDir = resolve(__dirname, '..')

function electronEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

test('a second desktop launch restores the hidden window instead of starting another app', async ({
  launchDevhub,
  workDir
}) => {
  const { app, page } = await launchDevhub()
  const mainPid = app.process().pid
  const windowVisible = () =>
    app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible() ?? false)

  await page.getByRole('button', { name: '关闭' }).click()
  await expect.poll(windowVisible).toBe(false)

  const executable = await app.evaluate(({ app: electronApp }) => electronApp.getPath('exe'))
  await execFileAsync(
    executable,
    [
      appDir,
      `--user-data-dir=${join(workDir, 'userdata')}`,
      ...(process.platform === 'linux' && process.env.CI ? ['--no-sandbox'] : [])
    ],
    { env: electronEnv(), timeout: 10_000 }
  )

  await expect.poll(windowVisible).toBe(true)
  expect(app.process().pid).toBe(mainPid)
  expect(app.process().exitCode).toBeNull()
})

test('a Linux profile with dead-owner singleton links can start again', async ({
  launchDevhub,
  workDir
}) => {
  test.skip(process.platform !== 'linux', 'Chromium uses these singleton links on Linux')
  const userData = join(workDir, 'userdata')
  const socketDir = join(workDir, 'dead-socket')
  const deadPid = 2_147_483_647
  await mkdir(userData, { recursive: true })
  await symlink(`${hostname()}-${deadPid}`, join(userData, 'SingletonLock'))
  await symlink('dead-cookie', join(userData, 'SingletonCookie'))
  await symlink(join(socketDir, 'SingletonSocket'), join(userData, 'SingletonSocket'))

  const { app, page } = await launchDevhub()

  await expect(page.getByRole('heading', { name: 'DevHub' })).toBeVisible()
  expect(app.process().exitCode).toBeNull()
  expect(await readlink(join(userData, 'SingletonLock'))).not.toBe(`${hostname()}-${deadPid}`)
})
