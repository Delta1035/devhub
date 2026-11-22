import type { Page } from '@playwright/test'
import { addProjectViaApi, expect, packageJson, test, type DevhubWindow } from '../support/fixtures'

const projectList = (page: Page) => page.getByRole('region', { name: '项目列表' })
const projectItems = (page: Page) => projectList(page).locator('section[aria-label="独立项目"] li')

test('sorts projects by name and path and retains sort order after restart', async ({
  launchDevhub,
  createProject
}) => {
  const alpha = await createProject('alpha-app', {
    'package.json': packageJson({ check: 'node -v' })
  })
  const beta = await createProject('beta-app', {
    'package.json': packageJson({ check: 'node -v' })
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

  // Default inactive sort is alphabetical: alpha, beta, charlie
  await expect(projectItems(page).nth(0)).toContainText('alpha-app')
  await expect(projectItems(page).nth(1)).toContainText('beta-app')
  await expect(projectItems(page).nth(2)).toContainText('charlie-app')

  // Switch to Name Descending
  await page.getByRole('button', { name: '项目排序' }).click()
  await page.getByRole('menuitemradio', { name: '名称降序 (Z-A)' }).click()

  await expect(projectItems(page).nth(0)).toContainText('charlie-app')
  await expect(projectItems(page).nth(1)).toContainText('beta-app')
  await expect(projectItems(page).nth(2)).toContainText('alpha-app')

  // Pinned projects still take precedence
  const betaButton = projectList(page).getByRole('button', { name: /^beta-app/ })
  await betaButton.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '置顶', exact: true }).click()

  // beta-app is pinned, followed by charlie-app, alpha-app
  await expect(projectItems(page).nth(0)).toContainText('beta-app')
  await expect(projectItems(page).nth(1)).toContainText('charlie-app')
  await expect(projectItems(page).nth(2)).toContainText('alpha-app')

  // Restart app and verify sort order and pin persist
  await app.close()
  page = (await launchDevhub()).page

  await expect(projectItems(page).nth(0)).toContainText('beta-app')
  await expect(projectItems(page).nth(1)).toContainText('charlie-app')
  await expect(projectItems(page).nth(2)).toContainText('alpha-app')
  await expect(page.getByRole('button', { name: '项目排序' })).toContainText('名称降序')
})

test('sorts batch tasks by name and persists selection after restart', async ({
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
  const projects = await page.evaluate(() =>
    (window as unknown as DevhubWindow).devhub.listProjects()
  )
  const project = projects[0]
  expect(project).toBeDefined()
  if (!project) throw new Error('Project not found')

  await page.evaluate(
    ({ projectId }) => {
      const api = (window as unknown as DevhubWindow).devhub
      return Promise.all([
        api.saveGroup({
          name: 'Z-Task',
          mode: 'parallel',
          steps: [
            {
              projectId,
              scriptId: `${projectId}:check`,
              continueWhen: { type: 'exit', timeoutSeconds: 60 }
            }
          ]
        }),
        api.saveGroup({
          name: 'A-Task',
          mode: 'parallel',
          steps: [
            {
              projectId,
              scriptId: `${projectId}:check`,
              continueWhen: { type: 'exit', timeoutSeconds: 60 }
            }
          ]
        })
      ])
    },
    { projectId: project.id }
  )

  await page.getByRole('button', { name: '批量', exact: true }).click()
  const groupsRegion = page.getByRole('region', { name: '批量任务' })
  const groupItems = groupsRegion.locator('ul li')

  // Switch to Name Ascending
  await page.getByRole('button', { name: '批量任务排序' }).click()
  await page.getByRole('menuitemradio', { name: '名称升序 (A-Z)' }).click()

  await expect(groupItems.nth(0)).toContainText('A-Task')
  await expect(groupItems.nth(1)).toContainText('Z-Task')

  // Switch to Name Descending
  await page.getByRole('button', { name: '批量任务排序' }).click()
  await page.getByRole('menuitemradio', { name: '名称降序 (Z-A)' }).click()

  await expect(groupItems.nth(0)).toContainText('Z-Task')
  await expect(groupItems.nth(1)).toContainText('A-Task')

  // Restart app and verify sort order persists
  await app.close()
  page = (await launchDevhub()).page

  await page.getByRole('button', { name: '批量', exact: true }).click()
  const restartedRegion = page.getByRole('region', { name: '批量任务' })
  const restartedGroupItems = restartedRegion.locator('ul li')

  await expect(restartedGroupItems.nth(0)).toContainText('Z-Task')
  await expect(restartedGroupItems.nth(1)).toContainText('A-Task')
  await expect(page.getByRole('button', { name: '批量任务排序' })).toContainText('名称降序')
})

test('sorts scripts by name and retains sort order after restart', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('script-sort-app', {
    'package.json': packageJson({
      echo: 'node -v',
      build: 'node -v',
      test: 'node -v'
    })
  })

  const first = await launchDevhub()
  const { app } = first
  let { page } = first
  await addProjectViaApi(page, dir)

  // Navigate to project detail by clicking project in list
  await projectList(page)
    .getByRole('button', { name: /^script-sort-app/ })
    .click()

  const projectContent = page.getByRole('region', { name: '项目内容' })
  const scriptItems = projectContent.locator('section ul li')

  // Default order is declaration order: echo, build, test
  await expect(scriptItems.nth(0)).toContainText('echo')
  await expect(scriptItems.nth(1)).toContainText('build')
  await expect(scriptItems.nth(2)).toContainText('test')

  // Switch to Name Ascending (A-Z) -> build, echo, test
  await projectContent.getByRole('button', { name: '脚本排序' }).click()
  await page.getByRole('menuitemradio', { name: '名称升序 (A-Z)' }).click()

  await expect(scriptItems.nth(0)).toContainText('build')
  await expect(scriptItems.nth(1)).toContainText('echo')
  await expect(scriptItems.nth(2)).toContainText('test')

  // Switch to Name Descending (Z-A) -> test, echo, build
  await projectContent.getByRole('button', { name: '脚本排序' }).click()
  await page.getByRole('menuitemradio', { name: '名称降序 (Z-A)' }).click()

  await expect(scriptItems.nth(0)).toContainText('test')
  await expect(scriptItems.nth(1)).toContainText('echo')
  await expect(scriptItems.nth(2)).toContainText('build')

  // Restart app and verify sort order persists
  await app.close()
  page = (await launchDevhub()).page

  await projectList(page)
    .getByRole('button', { name: /^script-sort-app/ })
    .click()
  const restartedContent = page.getByRole('region', { name: '项目内容' })
  const restartedScriptItems = restartedContent.locator('section ul li')

  await expect(restartedScriptItems.nth(0)).toContainText('test')
  await expect(restartedScriptItems.nth(1)).toContainText('echo')
  await expect(restartedScriptItems.nth(2)).toContainText('build')
  await expect(restartedContent.getByRole('button', { name: '脚本排序' })).toContainText('名称降序')
})
