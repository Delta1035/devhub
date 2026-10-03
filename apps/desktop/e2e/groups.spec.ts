import type { Page } from '@playwright/test'
import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from './fixtures'

// A server that becomes "ready" only after a while, so the serial order is observable.
const slowServer = (readyText: string, delayMs: number) => `
setTimeout(() => console.log(${JSON.stringify(readyText)}), ${delayMs})
setInterval(() => {}, 1000)
`

const listRuns = (page: Page) =>
  page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())

/** Switches the sidebar to the groups tab. */
const openGroups = async (page: Page) => {
  await page.getByRole('tab', { name: '批量' }).click()
  return page.getByRole('region', { name: '批量任务' })
}

/** Fills one step of the open group editor. */
const fillStep = async (
  page: Page,
  index: number,
  project: string,
  script: string,
  waitForText?: string
) => {
  const label = `第 ${index} 步`
  await page.getByLabel(`${label}的项目`).selectOption({ label: project })
  await page.getByLabel(`${label}的脚本`).selectOption({ label: `${script} · npm` })
  if (waitForText) await page.getByLabel(`${label}等待的文字`).fill(waitForText)
}

test('a serial group across projects waits for each step, then stops everything', async ({
  launchDevhub,
  createProject
}) => {
  const api = await createProject('api', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': slowServer('API ready', 1500)
  })
  const web = await createProject('web', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': slowServer('web up', 200)
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, api)
  await addProjectViaApi(page, web)

  const groups = await openGroups(page)
  await groups.getByRole('button', { name: '新建' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('front1')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'api', 'serve', 'API ready')
  await dialog.getByRole('button', { name: '添加步骤' }).click()
  await fillStep(page, 2, 'web', 'serve', 'web up')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()

  const item = groups.getByRole('listitem', { name: '批量任务 front1' })
  await expect(item).toContainText('串行')
  await item.getByRole('button', { name: '查看 front1' }).click()
  const detail = page.getByRole('region', { name: '任务运行 front1' })
  await expect(detail).toContainText('输出出现文字「API ready」')
  await item.getByRole('button', { name: '执行 front1' }).click()
  // The tab signals a running group even while the projects tab is shown.
  const running = page.getByRole('tab', { name: /批量/ }).getByRole('status')
  await expect(running).toBeVisible()
  await expect(item).toContainText('已完成', { timeout: 30_000 })
  await expect(running).toBeHidden()
  await expect(detail).toContainText('2/2 个步骤完成')
  await expect(detail).toContainText('服务进程可能仍在运行')
  await expect(detail.getByRole('button', { name: '停止全部' })).toBeEnabled()
  await expect(detail.getByRole('listitem', { name: '运行步骤 1' })).toContainText('本次启动')
  await detail
    .getByRole('listitem', { name: '运行步骤 1' })
    .getByRole('button', { name: '查看日志' })
    .click()
  await expect(page.getByRole('heading', { name: 'api', exact: true })).toBeVisible()
  await expect(
    page.locator('main').getByRole('button', { name: 'serve', exact: true })
  ).toHaveAttribute('aria-current', 'true')

  const runs = await listRuns(page)
  expect(runs.filter((run) => run.status === 'running')).toHaveLength(2)
  const projects = await page.evaluate(() =>
    (window as unknown as DevhubWindow).devhub.listProjects()
  )
  const startOf = (name: string) => {
    const projectId = projects.find((project) => project.name === name)?.id
    const run = runs.find((candidate) => candidate.projectId === projectId)
    return run ? Date.parse(run.startedAt) : Number.NaN
  }
  // web may only start after api printed "API ready", 1.5 s after api started.
  expect(startOf('web') - startOf('api')).toBeGreaterThanOrEqual(1000)

  await item.getByRole('button', { name: '停止 front1' }).click()
  await expect
    .poll(async () => (await listRuns(page)).filter((run) => run.status !== 'exited').length, {
      timeout: 20_000
    })
    .toBe(0)
})

test('a failing serial step stops the sequence and explains why', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ build: 'node -e "process.exit(1)"', serve: 'node -v' })
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const groups = await openGroups(page)
  await groups.getByRole('button', { name: '新建' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('broken')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'app', 'build')
  await page.getByLabel('第 1 步的继续条件').selectOption({ label: '进程成功退出' })
  await dialog.getByRole('button', { name: '添加步骤' }).click()
  await fillStep(page, 2, 'app', 'serve', 'never')
  await dialog.getByRole('button', { name: '保存' }).click()

  const item = groups.getByRole('listitem', { name: '批量任务 broken' })
  await item.getByRole('button', { name: '执行 broken' }).click()
  await expect(item).toContainText('失败')
  await expect(item).toContainText('进程退出码 1')
  await item.getByRole('button', { name: '查看 broken' }).click()
  const detail = page.getByRole('region', { name: '任务运行 broken' })
  await expect(detail.getByRole('listitem', { name: '运行步骤 1' })).toContainText('进程退出码 1')
  await expect(detail.getByRole('listitem', { name: '运行步骤 2' })).toContainText('已取消')

  const runs = await listRuns(page)
  expect(runs.map((run) => run.title)).toEqual(['build'])
})

test('waits for a regex in the output and remembers the result after a restart', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('api', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': slowServer('Started ApiApplication in 1.23 seconds', 300)
  })
  const first = await launchDevhub()
  const { app } = first
  let { page } = first
  await addProjectViaApi(page, dir)

  const groups = await openGroups(page)
  await groups.getByRole('button', { name: '新建' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('backend')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'api', 'serve')
  await dialog.getByLabel('第 1 步使用正则').check()
  await dialog.getByLabel('第 1 步等待的文字').fill(String.raw`Started \w+ in [\d.]+ seconds`)
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()

  const item = () => page.getByRole('listitem', { name: '批量任务 backend' })
  await item().getByRole('button', { name: '执行 backend' }).click()
  await expect(item()).toContainText(/已完成 · \d{2}:\d{2}/)
  await item().getByRole('button', { name: '查看 backend' }).click()
  const detail = () => page.getByRole('region', { name: '任务运行 backend' })
  await expect(detail()).toContainText('本次启动')
  await detail().getByRole('button', { name: '执行', exact: true }).click()
  await expect(detail()).toContainText('复用已有运行')
  await expect(detail()).toContainText('1/1 个步骤完成')

  await app.close()
  page = (await launchDevhub()).page
  await expect(item()).toContainText(/已完成 · \d{2}:\d{2}/)
  await item().getByRole('button', { name: '查看 backend' }).click()
  await expect(detail()).toContainText('日志不可用')
  await expect(detail().getByRole('button', { name: '查看日志' })).toHaveCount(0)
})
