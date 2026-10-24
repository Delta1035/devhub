import {
  addFromMenu,
  addProjectViaApi,
  packageJson,
  stubFolderPicker,
  test,
  expect
} from './fixtures'

test('adds a project with the folder picker, rejects duplicates, survives a restart, removes it', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('web-app', { 'package.json': packageJson({ dev: 'node -v' }) })

  const first = await launchDevhub()
  const { app } = first
  let { page } = first
  await expect(page.getByText('还没有项目')).toBeVisible()

  await stubFolderPicker(app, dir)
  await addFromMenu(page, '添加项目')
  const projectItem = page.locator('aside').getByRole('button', { name: /^web-app/ })
  await expect(projectItem).toBeVisible()
  await expect(page.getByRole('heading', { name: 'web-app' })).toBeVisible()

  await addFromMenu(page, '添加项目')
  await expect(page.getByText('项目已存在：web-app')).toBeVisible()

  await app.close()
  page = (await launchDevhub()).page
  await expect(page.locator('aside').getByRole('button', { name: /^web-app/ })).toBeVisible()

  // The × only asks: cancelling keeps the project.
  await page.getByRole('button', { name: '移除 web-app' }).click()
  const confirm = page.getByRole('dialog', { name: '移除项目「web-app」？' })
  await confirm.getByRole('button', { name: '取消' }).click()
  await expect(confirm).toBeHidden()
  await expect(page.locator('aside').getByRole('button', { name: /^web-app/ })).toBeVisible()

  await page.getByRole('button', { name: '移除 web-app' }).click()
  await confirm.getByRole('button', { name: '确认移除' }).click()
  await expect(page.getByText('还没有项目')).toBeVisible()
})

test('moves active project to the top and restores order when stopped', async ({
  launchDevhub,
  createProject
}) => {
  const tickScript = `
let n = 0
setInterval(() => console.log('tick ' + ++n), 200)
`
  const dirA = await createProject('alpha-app', {
    'package.json': packageJson({ dev: 'node -v' })
  })
  const dirB = await createProject('beta-app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': tickScript
  })

  const { page } = await launchDevhub()
  await addProjectViaApi(page, dirA)
  await addProjectViaApi(page, dirB)

  const items = page.locator('aside section[aria-label="独立项目"] li')
  await expect(items.first()).toContainText('alpha-app')
  await expect(items.nth(1)).toContainText('beta-app')

  // Select beta-app and run its script to make it active
  await page
    .locator('aside')
    .getByRole('button', { name: /^beta-app/ })
    .click()
  await page.getByRole('button', { name: '运行 tick' }).click()

  // beta-app becomes active and jumps to the top
  await expect(items.first()).toContainText('beta-app')
  await expect(items.nth(1)).toContainText('alpha-app')

  // Stop the script; beta-app exits and drops back
  await page.getByRole('button', { name: '停止 tick' }).click()
  await expect(items.first()).toContainText('alpha-app')
  await expect(items.nth(1)).toContainText('beta-app')
})

test('falls back to active project when the selected project is removed', async ({
  launchDevhub,
  createProject
}) => {
  const tickScript = `
let n = 0
setInterval(() => console.log('tick ' + ++n), 200)
`
  const dirA = await createProject('alpha-app', {
    'package.json': packageJson({ dev: 'node -v' })
  })
  const dirB = await createProject('beta-app', {
    'package.json': packageJson({ dev: 'node -v' })
  })
  const dirC = await createProject('charlie-app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': tickScript
  })

  const { page } = await launchDevhub()
  await addProjectViaApi(page, dirA)
  await addProjectViaApi(page, dirB)
  await addProjectViaApi(page, dirC)

  // Start tick on charlie-app so it is active
  await page
    .locator('aside')
    .getByRole('button', { name: /^charlie-app/ })
    .click()
  await page.getByRole('button', { name: '运行 tick' }).click()

  // Select alpha-app
  await page
    .locator('aside')
    .getByRole('button', { name: /^alpha-app/ })
    .click()
  await expect(page.getByRole('heading', { name: 'alpha-app' })).toBeVisible()

  // Remove alpha-app: should fall back to charlie-app (active) rather than beta-app (first inactive)
  await page.getByRole('button', { name: '移除 alpha-app' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click()
  await expect(page.getByRole('heading', { name: 'charlie-app' })).toBeVisible()
})
