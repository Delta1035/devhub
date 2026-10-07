import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from './fixtures'

// Spawns a child process and records both pids, so the test can check the whole tree.
const serverScript = `
const { spawn } = require('child_process')
const { writeFileSync } = require('fs')
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
writeFileSync('pids.json', JSON.stringify({ parent: process.pid, child: child.pid }))
setInterval(() => console.log('serving'), 500)
`

const pidsSchema = z.object({ parent: z.number().int(), child: z.number().int() })

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

test('quitting DevHub stops the whole process tree of running scripts', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('server', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': serverScript
  })
  const { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  await page.getByRole('button', { name: '运行 serve' }).click()
  await expect(page.locator('.xterm-rows')).toContainText('serving')

  const pids = pidsSchema.parse(JSON.parse(await readFile(join(dir, 'pids.json'), 'utf8')))
  const shellPid = await page.evaluate(
    async () => (await (window as unknown as DevhubWindow).devhub.listRuns())[0]?.pid
  )
  const tree = [shellPid, pids.parent, pids.child].filter((pid) => pid !== undefined)
  expect(tree).toHaveLength(3)
  expect(tree.every(isAlive)).toBe(true)

  await app.close()
  await expect.poll(() => tree.filter(isAlive), { timeout: 15_000 }).toEqual([])
})

// Logout, shutdown and `systemctl --user stop` send SIGTERM first; Windows has no equivalent.
test.describe('SIGTERM', () => {
  test.skip(process.platform === 'win32', 'POSIX signals only')

  test('quits DevHub gracefully when nothing is running', async ({ launchDevhub }) => {
    const { app } = await launchDevhub()
    const child = app.process()
    const exited = new Promise((resolve) => child.once('exit', resolve))

    child.kill('SIGTERM')
    await exited
    // A graceful quit exits normally; the default handler would report the signal instead.
    expect({ code: child.exitCode, signal: child.signalCode }).toEqual({ code: 0, signal: null })
  })

  test('stops the process tree of running scripts', async ({ launchDevhub, createProject }) => {
    const dir = await createProject('server', {
      'package.json': packageJson({ serve: 'node server.js' }),
      'server.js': serverScript
    })
    const { app, page } = await launchDevhub()
    await addProjectViaApi(page, dir)
    await page.getByRole('button', { name: '运行 serve' }).click()
    await expect(page.locator('.xterm-rows')).toContainText('serving')
    const pids = pidsSchema.parse(JSON.parse(await readFile(join(dir, 'pids.json'), 'utf8')))
    const tree = [pids.parent, pids.child]
    expect(tree.every(isAlive)).toBe(true)

    const child = app.process()
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await exited
    expect(child.exitCode).toBe(0)
    await expect.poll(() => tree.filter(isAlive), { timeout: 15_000 }).toEqual([])
  })
})
