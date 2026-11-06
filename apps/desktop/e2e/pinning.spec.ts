import type { Page } from '@playwright/test'
import { addProjectViaApi, expect, packageJson, test, type DevhubWindow } from './fixtures'

const projectItems = (page: Page) => page.locator('aside section[aria-label="独立项目"] li')

test('pins a project above active projects and keeps the pin after restart', async ({
  launchDevhub,
  createProject
}) => {
  const alpha = await createProject('alpha-app', {
    'package.json': packageJson({ check: 'node -v' })
  })
  const beta = await createProject('beta-app', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': 'setInterval(() => {}, 1000)'
  })
  const charlie = await createProject('charlie-app', {
    'package.json': packageJson({ check: 'node -v' })
  })
  const first = await launchDevhub()
  const { app } = first
  let { page } = first
  await addProjectViaApi(page, alpha)
  await addProjectViaApi(page, beta)
  await addProjectViaApi(page, charlie)

  await page
    .locator('aside')
    .getByRole('button', { name: /^beta-app/ })
    .click()
  await page.getByRole('button', { name: '运行 serve' }).click()
  await expect(projectItems(page).first()).toContainText('beta-app')

  const charlieButton = page.locator('aside').getByRole('button', { name: /^charlie-app/ })
  await charlieButton.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '置顶', exact: true }).click()
  await expect(projectItems(page).first()).toContainText('charlie-app')
  await expect(projectItems(page).first().getByLabel('已置顶')).toBeVisible()

  await app.close()
  page = (await launchDevhub()).page
  await expect(projectItems(page).first()).toContainText('charlie-app')
  await expect(projectItems(page).first().getByLabel('已置顶')).toBeVisible()

  await page
    .locator('aside')
    .getByRole('button', { name: /^charlie-app/ })
    .click({ button: 'right' })
  await page.getByRole('menuitem', { name: '取消置顶' }).click()
  await expect(projectItems(page).first()).toContainText('alpha-app')
})

test('pins a batch task from its operations menu and keeps the pin after restart', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ check: 'node -v' })
  })
  const first = await launchDevhub()
  const { app } = first
  let { page } = first
  await addProjectViaApi(page, dir)
  await page.evaluate(async () => {
    const api = (window as unknown as DevhubWindow).devhub
    const project = (await api.listProjects())[0]
    if (!project) throw new Error('fixture project missing')
    const step = {
      projectId: project.id,
      scriptId: 'npm:check',
      continueWhen: { type: 'delay' as const, seconds: 0 }
    }
    await api.saveGroup({ name: 'alpha-task', mode: 'parallel', steps: [step] })
    await api.saveGroup({ name: 'beta-task', mode: 'parallel', steps: [step] })
  })
  await page.getByRole('tab', { name: '批量' }).click()
  const groupItems = () => page.getByRole('region', { name: '批量任务' }).getByRole('listitem')
  await expect(groupItems().first()).toContainText('alpha-task')

  await page.getByRole('button', { name: 'beta-task 的更多操作' }).click()
  await page.getByRole('menuitem', { name: '置顶', exact: true }).click()
  await expect(groupItems().first()).toContainText('beta-task')
  await expect(groupItems().first().getByLabel('已置顶')).toBeVisible()

  await app.close()
  page = (await launchDevhub()).page
  await page.getByRole('tab', { name: '批量' }).click()
  await expect(groupItems().first()).toContainText('beta-task')
  await expect(groupItems().first().getByLabel('已置顶')).toBeVisible()

  await page.getByRole('button', { name: 'beta-task 的更多操作' }).click()
  await page.getByRole('menuitem', { name: '取消置顶' }).click()
  await expect(groupItems().first()).toContainText('alpha-task')
})
