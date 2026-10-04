import { addFromMenu, packageJson, stubFolderPicker, test, expect } from './fixtures'

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

  await page.getByRole('button', { name: '移除 web-app' }).click()
  await expect(page.getByText('还没有项目')).toBeVisible()
})
