import { addProjectViaApi, packageJson, test, expect } from './fixtures'

const tickScript = `
let n = 0
setInterval(() => console.log('\\x1b[32mtick\\x1b[0m ' + ++n), 200)
`
const askScript = `
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout })
rl.question('你叫什么名字？ ', (name) => { console.log('你好，' + name + '！'); rl.close() })
`

test('runs a script, streams its output, stops it, and shows exit codes', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ tick: 'node tick.js', fail: 'node -e "process.exit(3)"' }),
    'tick.js': tickScript
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const tickRow = page.locator('main li', { hasText: 'npm run tick' })
  await page.getByRole('button', { name: '运行 tick' }).click()
  await expect(tickRow.getByText('运行中')).toBeVisible()
  await expect(page.locator('.xterm-rows')).toContainText('tick 3')

  await page.getByRole('button', { name: '停止 tick' }).click()
  await expect(tickRow.getByText('已停止')).toBeVisible()

  const failRow = page.locator('main li', { hasText: 'npm run fail' })
  await page.getByRole('button', { name: '运行 fail' }).click()
  await expect(failRow.getByText('退出码 3')).toBeVisible()
})

test('sends terminal input to the running process', async ({ launchDevhub, createProject }) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ ask: 'node ask.js' }),
    'ask.js': askScript
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  await page.getByRole('button', { name: '运行 ask' }).click()
  const terminal = page.locator('.xterm-rows')
  await expect(terminal).toContainText('你叫什么名字？')

  await page.locator('.xterm').click()
  await page.keyboard.type('E2E')
  await page.keyboard.press('Enter')
  await expect(terminal).toContainText('你好，E2E！')
  await expect(
    page.locator('main li', { hasText: 'npm run ask' }).getByText('已完成')
  ).toBeVisible()
})
