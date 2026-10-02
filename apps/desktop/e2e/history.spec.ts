import { addProjectViaApi, packageJson, test, expect } from './fixtures'

test('lists how earlier runs ended, and keeps them after a restart', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({
      check: 'node -e "setTimeout(() => process.exit(3), 1500)"',
      serve: 'node -e "setInterval(() => {}, 1000)"'
    })
  })
  const first = await launchDevhub()
  let { page } = first
  await addProjectViaApi(page, dir)

  const checkRow = page.locator('main li', { hasText: 'npm run check' })
  const serveRow = page.locator('main li', { hasText: 'npm run serve' })

  // Nothing yet.
  await page.getByRole('button', { name: 'check 的运行历史' }).click()
  const history = page.getByRole('dialog', { name: 'check 的运行历史' })
  await expect(history).toContainText('还没有结束过的运行')
  await page.keyboard.press('Escape')

  // A failing run, and a server the user stops.
  await page.getByRole('button', { name: '运行 check' }).click()
  await expect(checkRow.getByText('退出码 3')).toBeVisible()
  await page.getByRole('button', { name: '运行 serve' }).click()
  await page.getByRole('button', { name: '停止 serve' }).click()
  await expect(serveRow.getByText('已停止')).toBeVisible()

  await page.getByRole('button', { name: 'check 的运行历史' }).click()
  await expect(history.getByRole('listitem')).toHaveCount(1)
  await expect(history.getByRole('listitem')).toContainText(/今天 \d\d:\d\d/)
  await expect(history.getByRole('listitem')).toContainText('退出码 3')
  // Stays current while open: a run that ends meanwhile appears on top. (Opened once the run
  // is going: starting one focuses its terminal, which closes the popover.)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '运行 check' }).click()
  await expect(page.getByRole('button', { name: '停止 check' })).toBeVisible()
  await page.getByRole('button', { name: 'check 的运行历史' }).click()
  await expect(history.getByRole('listitem')).toHaveCount(1)
  await expect(history.getByRole('listitem')).toHaveCount(2)
  await page.keyboard.press('Escape')

  await first.app.close()
  page = (await launchDevhub()).page
  await page.getByRole('button', { name: 'serve 的运行历史' }).click()
  const serveHistory = page.getByRole('dialog', { name: 'serve 的运行历史' })
  await expect(serveHistory.getByRole('listitem')).toHaveCount(1)
  await expect(serveHistory.getByRole('listitem')).toContainText('已停止')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'check 的运行历史' }).click()
  await expect(
    page.getByRole('dialog', { name: 'check 的运行历史' }).getByRole('listitem')
  ).toHaveCount(2)
})
