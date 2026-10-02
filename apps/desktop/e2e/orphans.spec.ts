import { spawnSync } from 'child_process'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from './fixtures'

// Ignores SIGHUP, so on Linux it outlives a terminal that goes away.
const serverScript = `
process.on('SIGHUP', () => {})
const { spawn } = require('child_process')
const { writeFileSync } = require('fs')
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
writeFileSync('pids.json', JSON.stringify({ parent: process.pid, child: child.pid }))
setInterval(() => console.log('serving'), 500)
`

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// Which processes outlive a crash depends on the OS: on Windows console programs end with
// the pseudo-console, but Git Bash does not; on Linux, programs ignoring SIGHUP survive.
// An interactive shell running a server covers the real cases on both platforms.
test('after a crash, the next launch offers to stop the processes left behind', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('server', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': serverScript
  })
  const first = await launchDevhub()
  await addProjectViaApi(first.page, dir)
  await first.page.getByRole('button', { name: '新建终端' }).click()
  await expect(first.page.locator('.xterm-rows')).toContainText('$')
  await first.page.locator('.xterm').click()
  await first.page.keyboard.type('node server.js')
  await first.page.keyboard.press('Enter')
  await expect(first.page.locator('.xterm-rows')).toContainText('serving')
  const runPid = await first.page.evaluate(
    async () => (await (window as unknown as DevhubWindow).devhub.listRuns())[0]?.pid
  )
  const pids = z
    .object({ parent: z.number(), child: z.number() })
    .parse(JSON.parse(await readFile(join(dir, 'pids.json'), 'utf8')))
  // Give the registry a moment to record the run (it reads the process start time).
  await first.page.waitForTimeout(2000)

  // Simulate a crash: end DevHub's own processes without letting it clean up. The scripts
  // it started are separate trees (spawned through the PTY), so they survive, as in a crash.
  const mainPid = await first.app.evaluate(() => process.pid)
  const electronPids = [first.app.process().pid, mainPid].filter(
    (pid): pid is number => pid !== undefined
  )
  for (const pid of electronPids) {
    if (process.platform === 'win32') {
      // Just the process, like a crash: /T would also take the scripts down with it.
      spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' })
    } else {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  }
  await expect.poll(() => electronPids.filter(isAlive), { timeout: 10_000 }).toEqual([])
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const survivors = [runPid, pids.parent, pids.child].filter(
    (pid): pid is number => pid !== undefined && isAlive(pid)
  )
  test.skip(survivors.length === 0, 'the OS already ended the processes with DevHub')

  const second = await launchDevhub()
  const banner = second.page.getByRole('alert').filter({ hasText: '遗留' })
  await expect(banner).toContainText('server · 终端 1')
  await banner.getByRole('button', { name: '全部结束' }).click()
  await expect(banner).toBeHidden()
  await expect.poll(() => survivors.filter(isAlive), { timeout: 15_000 }).toEqual([])
})
