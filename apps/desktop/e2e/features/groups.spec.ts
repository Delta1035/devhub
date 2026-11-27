import type { Page } from '@playwright/test'
import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from '../support/fixtures'

// A server that becomes "ready" only after a while, so the serial order is observable.
const slowServer = (readyText: string, delayMs: number) => `
setTimeout(() => console.log(${JSON.stringify(readyText)}), ${delayMs})
setInterval(() => {}, 1000)
`

const listRuns = (page: Page) =>
  page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())

/** Switches the feature navigation to the batch workspace. */
const openGroups = async (page: Page) => {
  await page.getByRole('button', { name: '批量', exact: true }).click()
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
  await groups.getByRole('button', { name: '新建', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('front1')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'api', 'serve', 'API ready')
  await page.getByLabel('第 1 步的任务类型').selectOption({ label: '持续运行任务' })
  await dialog.getByRole('button', { name: '添加步骤' }).click()
  await fillStep(page, 2, 'web', 'serve', 'web up')
  await page.getByLabel('第 2 步的任务类型').selectOption({ label: '持续运行任务' })
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()

  const item = groups.getByRole('listitem', { name: '批量任务 front1' })
  await expect(item).toContainText('串行')
  await expect(item.getByRole('button', { name: '执行 front1' })).toHaveCount(0)
  await expect(item.getByRole('button', { name: '停止 front1' })).toHaveCount(0)
  // Clicking anywhere on the task card (not only the title) selects the batch task.
  await item.getByText('2 步 · 串行').click()
  const detail = page.getByRole('region', { name: '任务运行 front1' })
  await expect(detail).toContainText('输出出现文字「API ready」')
  // Batch workspace does not cause window-level page scrolling.
  await page.mouse.move(500, 60)
  await page.mouse.wheel(0, 500)
  const windowScrolls = await page.evaluate(() => ({
    overflows: document.documentElement.scrollHeight > window.innerHeight,
    scrollY: window.scrollY,
    scrollTop: document.documentElement.scrollTop
  }))
  expect(windowScrolls.overflows).toBe(false)
  expect(windowScrolls.scrollY).toBe(0)
  expect(windowScrolls.scrollTop).toBe(0)
  await detail.getByRole('button', { name: '执行', exact: true }).click()
  // The feature navigation and the persistent bar name the group while it starts.
  const running = page.getByRole('button', { name: '运行中', exact: true }).getByRole('status')
  const titleBar = page.getByRole('banner').getByRole('button', { name: /^正在运行：/ })
  await expect(running).toHaveText(/\d+/)
  await page.getByRole('button', { name: '运行中', exact: true }).click()
  const bar = page.getByRole('region', { name: '正在运行的批量任务' })
  await expect(bar).toContainText(/front1启动中 \d\/2/)
  await expect(titleBar).toHaveCount(0)
  await page.getByRole('button', { name: '批量', exact: true }).click()
  await expect(item).toContainText('运行中 2/2', { timeout: 30_000 })
  // The navigation badge and bar remain while the servers keep running after the execution ended.
  await expect(running).toHaveText('2')
  await page.getByRole('button', { name: '运行中', exact: true }).click()
  await expect(bar).toContainText('front1运行中 2/2')
  const childrenList = bar.getByRole('list', { name: 'front1 的子任务' })
  await expect(childrenList).toContainText('api · serve')
  await expect(childrenList).toContainText('web · serve')
  await expect(bar.getByRole('button', { name: '重新执行批量任务 front1' })).toBeEnabled()
  await expect(titleBar).toHaveCount(0)
  await page.getByRole('button', { name: '批量', exact: true }).click()
  await expect(detail).toContainText('2 个已就绪')
  await expect(detail).toContainText('启动流程已完成')
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
  await page.getByRole('button', { name: /^脚本/ }).click()
  // The script row tells which batch run started it.
  await expect(page.locator('main').getByText('批量：front1')).toBeVisible()

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

  const groupsView = await openGroups(page)
  await groupsView
    .getByRole('listitem', { name: '批量任务 front1' })
    .getByText('2 步 · 串行')
    .click()
  await page
    .getByRole('region', { name: '任务运行 front1' })
    .getByRole('button', { name: '停止全部' })
    .click()
  await expect
    .poll(async () => (await listRuns(page)).filter((run) => run.status !== 'exited').length, {
      timeout: 20_000
    })
    .toBe(0)
  await expect(bar).toBeHidden()
  await expect(running).toBeHidden()
  await expect(titleBar).toHaveCount(0)
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
  await groups.getByRole('button', { name: '新建', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('broken')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'app', 'build')
  await page.getByLabel('第 1 步的任务类型').selectOption({ label: '一次性任务' })
  await dialog.getByRole('button', { name: '添加步骤' }).click()
  await fillStep(page, 2, 'app', 'serve', 'never')
  await dialog.getByRole('button', { name: '保存' }).click()

  const item = groups.getByRole('listitem', { name: '批量任务 broken' })
  await item.getByRole('button', { name: '查看 broken' }).click()
  const detail = page.getByRole('region', { name: '任务运行 broken' })
  await detail.getByRole('button', { name: '执行', exact: true }).click()
  await expect(item).toContainText('失败')
  await expect(item).toContainText('进程退出码 1')
  await expect(detail.getByRole('listitem', { name: '运行步骤 1' })).toContainText('进程退出码 1')
  await expect(detail.getByRole('listitem', { name: '运行步骤 2' })).toContainText('已取消')

  const runs = await listRuns(page)
  expect(runs.map((run) => run.title)).toEqual(['build'])
})

test('a one-shot step completes only after its process exits successfully', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('builder', {
    'package.json': packageJson({ build: 'node -e "setTimeout(() => process.exit(0), 300)"' })
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const groups = await openGroups(page)
  await groups.getByRole('button', { name: '新建', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('release build')
  await fillStep(page, 1, 'builder', 'build')
  await dialog.getByLabel('第 1 步的任务类型').selectOption({ label: '一次性任务' })
  await dialog.getByRole('button', { name: '保存' }).click()

  const item = groups.getByRole('listitem', { name: '批量任务 release build' })
  await item.getByRole('button', { name: '查看 release build' }).click()
  const detail = page.getByRole('region', { name: '任务运行 release build' })
  await detail.getByRole('button', { name: '执行', exact: true }).click()
  await expect(item).toContainText('已完成', { timeout: 20_000 })
  await expect(detail).toContainText('1/1 个步骤完成')
  await expect(detail.getByRole('listitem', { name: '运行步骤 1' })).toContainText('已完成')
})

test('a failed persistent step stays visible while another persistent run remains alive', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('watcher', {
    'package.json': packageJson({ dev: 'node watcher.js', serve: 'node server.js' }),
    'watcher.js': `console.log('watching'); setTimeout(() => process.exit(2), 1500)`,
    'server.js': `console.log('alive'); setInterval(() => {}, 1000)`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const groups = await openGroups(page)
  await groups.getByRole('button', { name: '新建', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('watch files')
  await fillStep(page, 1, 'watcher', 'dev', 'watching')
  await dialog.getByRole('button', { name: '添加步骤' }).click()
  await fillStep(page, 2, 'watcher', 'serve', 'alive')
  await dialog.getByRole('button', { name: '保存' }).click()

  const item = groups.getByRole('listitem', { name: '批量任务 watch files' })
  await item.getByRole('button', { name: '查看 watch files' }).click()
  const detail = page.getByRole('region', { name: '任务运行 watch files' })
  await detail.getByRole('button', { name: '执行', exact: true }).click()
  await expect(item).toContainText('失败', { timeout: 20_000 })
  await expect(item).toContainText('持续运行任务异常退出（退出码 2）')
  await expect(detail).toContainText('失败 · 1 个服务仍存活')
  await expect(detail).toContainText('启动流程异常结束，当前有 1 个持续运行任务')
  await expect(detail.getByRole('listitem', { name: '运行步骤 1' })).toContainText('异常退出')
  await expect(detail.getByRole('listitem', { name: '运行步骤 2' })).toContainText('已就绪')
  await detail.getByRole('button', { name: '停止全部' }).click()
  await expect
    .poll(async () => (await listRuns(page)).filter((run) => run.status !== 'exited').length)
    .toBe(0)
  await expect(detail.getByRole('listitem', { name: '运行步骤 2' })).toContainText('已停止')
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
  await groups.getByRole('button', { name: '新建', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('backend')
  await dialog.getByRole('button', { name: /^串行/ }).click()
  await fillStep(page, 1, 'api', 'serve')
  await page.getByLabel('第 1 步的任务类型').selectOption({ label: '持续运行任务' })
  await dialog.getByLabel('第 1 步使用正则').check()
  await dialog.getByLabel('第 1 步等待的文字').fill(String.raw`Started \w+ in [\d.]+ seconds`)
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()

  const item = () => page.getByRole('listitem', { name: '批量任务 backend' })
  await item().getByRole('button', { name: '查看 backend' }).click()
  const detail = () => page.getByRole('region', { name: '任务运行 backend' })
  await detail().getByRole('button', { name: '执行', exact: true }).click()
  await expect(item()).toContainText('运行中 1/1', { timeout: 30_000 })
  await expect(detail()).toContainText('本次启动')
  await detail().getByRole('button', { name: '执行', exact: true }).click()
  await expect(detail()).toContainText('复用已有运行')
  await expect(detail()).toContainText('1 个已就绪')

  await app.close()
  page = (await launchDevhub()).page
  await openGroups(page)
  await expect(item()).toContainText(/已停止 · \d{2}:\d{2}/)
  await item().getByRole('button', { name: '查看 backend' }).click()
  await expect(detail()).toContainText('日志不可用')
  await expect(detail().getByRole('button', { name: '查看日志' })).toHaveCount(0)
})

test('shows parent-child hierarchy, cross-group reuse links, and standalone runs in running view', async ({
  launchDevhub,
  createProject
}) => {
  const api = await createProject('api', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': slowServer('API ready', 100)
  })
  const web = await createProject('web', {
    'package.json': packageJson({ dev: 'node server.js' }),
    'server.js': slowServer('Web ready', 100)
  })
  const tools = await createProject('tools', {
    'package.json': packageJson({ watch: 'node watch.js' }),
    'watch.js': 'setInterval(() => {}, 1000)'
  })

  const { page } = await launchDevhub()
  await addProjectViaApi(page, api)
  await addProjectViaApi(page, web)
  await addProjectViaApi(page, tools)

  // Start standalone tools:watch
  await page
    .getByRole('region', { name: '项目列表' })
    .getByRole('button', { name: /^tools/ })
    .click()
  await page.getByRole('button', { name: '运行 watch' }).click()

  // Create two batch groups that share api:serve, starting backend-only first so full-stack reuses it.
  const groupIds = await page.evaluate(async () => {
    const devhub = (window as unknown as DevhubWindow).devhub
    const projects = await devhub.listProjects()
    const apiId = projects.find((p) => p.name === 'api')?.id
    const webId = projects.find((p) => p.name === 'web')?.id
    if (!apiId || !webId) throw new Error('missing projects')
    const g1 = await devhub.saveGroup({
      name: 'backend-only',
      mode: 'parallel',
      steps: [
        {
          projectId: apiId,
          scriptId: 'npm:serve',
          executionKind: 'persistent' as const,
          continueWhen: { type: 'delay', seconds: 0 }
        }
      ]
    })
    const g2 = await devhub.saveGroup({
      name: 'full-stack',
      mode: 'parallel',
      steps: [
        {
          projectId: apiId,
          scriptId: 'npm:serve',
          executionKind: 'persistent' as const,
          continueWhen: { type: 'delay', seconds: 0 }
        },
        {
          projectId: webId,
          scriptId: 'npm:dev',
          executionKind: 'persistent' as const,
          continueWhen: { type: 'delay', seconds: 0 }
        }
      ]
    })
    await devhub.startGroup(g1.id)
    return { g1: g1.id, g2: g2.id }
  })

  await expect
    .poll(async () => {
      const states = await page.evaluate(() =>
        (window as unknown as DevhubWindow).devhub.listGroupStates()
      )
      return states.find((s) => s.groupId === groupIds.g1)?.status
    })
    .toBe('ready')

  await page.evaluate(
    (id) => (window as unknown as DevhubWindow).devhub.startGroup(id),
    groupIds.g2
  )

  await page.getByRole('button', { name: '运行中', exact: true }).click()
  const runningBadge = page.getByRole('button', { name: '运行中', exact: true }).getByRole('status')
  await expect(runningBadge).toHaveText('3')

  const batchRegion = page.getByRole('region', { name: '正在运行的批量任务' })
  const backendChildren = batchRegion.getByRole('list', { name: 'backend-only 的子任务' })
  const fullStackChildren = batchRegion.getByRole('list', { name: 'full-stack 的子任务' })
  await expect(backendChildren).toContainText('api · serve')
  await expect(backendChildren).toContainText('关联：full-stack')
  await expect(fullStackChildren).toContainText('api · serve')
  await expect(fullStackChildren).toContainText('关联：backend-only')
  await expect(fullStackChildren).toContainText('web · dev')

  const standaloneRegion = page.getByRole('region', { name: '独立运行' })
  await expect(standaloneRegion).toContainText('tools · watch')

  // Re-run from Running view reuses the running api:serve process
  await batchRegion.getByRole('button', { name: '重新执行批量任务 backend-only' }).click()
  await batchRegion.getByRole('button', { name: '查看运行中的批量任务 backend-only' }).click()
  const detail = page.getByRole('region', { name: '任务运行 backend-only' })
  await expect(detail).toContainText('复用已有运行')
})
