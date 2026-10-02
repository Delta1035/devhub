import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import { addProjectViaApi, packageJson, test, expect } from './fixtures'

// Started by typing in the terminal; records its pid so the test can check it was stopped.
const serverScript = `
require('fs').writeFileSync('server.pid', String(process.pid))
setInterval(() => console.log('still serving'), 500)
`

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

test('opens a terminal in the project, runs commands, and closing it stops them', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ dev: 'node -v' }),
    'server.js': serverScript
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  await page.getByRole('button', { name: '新建终端' }).click()
  await expect(page.getByRole('button', { name: '终端 1', exact: true })).toBeVisible()

  // The default shell is bash on both CI platforms (Git Bash on Windows); arithmetic expansion
  // proves the command really ran in it, since the echoed input line shows the raw text.
  const terminal = page.locator('.xterm-rows')
  await page.locator('.xterm').click()
  await page.keyboard.type('echo "sum=$((6*7))"')
  await page.keyboard.press('Enter')
  await expect(terminal).toContainText('sum=42')

  await page.keyboard.type('node server.js')
  await page.keyboard.press('Enter')
  await expect(terminal).toContainText('still serving')
  const pid = z.coerce
    .number()
    .int()
    .parse(await readFile(join(dir, 'server.pid'), 'utf8'))
  expect(isAlive(pid)).toBe(true)

  await page.getByRole('button', { name: '关闭 终端 1' }).click()
  await expect(page.getByRole('button', { name: '终端 1', exact: true })).toBeHidden()
  await expect.poll(() => isAlive(pid), { timeout: 15_000 }).toBe(false)
})
