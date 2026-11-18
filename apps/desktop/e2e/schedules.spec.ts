import { addProjectViaApi, expect, packageJson, test, type DevhubWindow } from './fixtures'

const openSchedules = async (page: Parameters<typeof addProjectViaApi>[0]) => {
  await page.getByRole('button', { name: '定时', exact: true }).click()
  await expect(page.getByRole('heading', { name: '定时任务', exact: true })).toBeVisible()
}

test('creates and immediately runs a scheduled script with an explicit exit warning', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('scheduled-app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': 'setInterval(() => {}, 1000)'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await openSchedules(page)

  await page.getByRole('button', { name: '新建定时任务' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('工作日脚本')
  await dialog.getByLabel('项目').selectOption({ label: 'scheduled-app' })
  await dialog.getByLabel('脚本').selectOption({ label: 'tick' })
  await dialog.getByLabel('时间规则').selectOption('cron')
  await dialog.getByLabel('Cron 表达式').fill('*/5 * * * *')
  await expect(dialog).toContainText('DevHub 退出后不会执行任务')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()

  const card = page.getByRole('article', { name: '定时任务 工作日脚本' })
  await expect(card).toContainText('Cron · */5 * * * *')
  const project = await page.evaluate(() =>
    (window as unknown as DevhubWindow).devhub.listProjects()
  )
  const projectId = project[0]?.id
  if (!projectId) throw new Error('test project was not added')
  const existingRun = await page.evaluate(
    ({ projectId }) =>
      (window as unknown as DevhubWindow).devhub.startScript(projectId, 'npm:tick'),
    { projectId }
  )
  await card.getByRole('button', { name: '立即执行 工作日脚本' }).click()
  await expect(card).toContainText('已跳过')

  await card.getByRole('button', { name: '编辑 工作日脚本' }).click()
  const editor = page.getByRole('dialog')
  await editor.getByRole('button', { name: '停止后重新执行' }).click()
  await editor.getByRole('button', { name: '保存' }).click()
  await expect(editor).toBeHidden()
  await card.getByRole('button', { name: '立即执行 工作日脚本' }).click()
  await expect(card).toContainText('已触发')

  const runs = await page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())
  const activeRun = runs.find(
    (run) => run.kind === 'script' && run.status !== 'exited' && run.scriptId === 'npm:tick'
  )
  expect(activeRun?.id).not.toBe(existingRun.id)
  if (activeRun) {
    await page.evaluate(
      (runId) => (window as unknown as DevhubWindow).devhub.stopRun(runId),
      activeRun.id
    )
  }
})

test('creates a schedule for an existing batch task', async ({ launchDevhub, createProject }) => {
  const dir = await createProject('scheduled-group-app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': 'setInterval(() => {}, 1000)'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  const project = await page.evaluate(() =>
    (window as unknown as DevhubWindow).devhub.listProjects()
  )
  const projectId = project[0]?.id
  if (!projectId) throw new Error('test project was not added')
  const group = await page.evaluate(
    ({ projectId }) =>
      (window as unknown as DevhubWindow).devhub.saveGroup({
        name: '定时批量任务',
        mode: 'parallel',
        steps: [
          {
            projectId,
            scriptId: 'npm:tick',
            continueWhen: { type: 'exit', timeoutSeconds: 30 }
          }
        ]
      }),
    { projectId }
  )
  await openSchedules(page)
  await page.getByRole('button', { name: '新建定时任务' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('名称').fill('定时批量执行')
  await dialog.getByLabel('执行目标类型').selectOption('group')
  await dialog.getByLabel('批量任务').selectOption({ label: '定时批量任务' })
  await dialog.getByLabel('时间规则').selectOption('interval')
  await dialog.getByLabel('间隔分钟数').fill('30')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()
  const card = page.getByRole('article', { name: '定时任务 定时批量执行' })
  await expect(card).toContainText('批量任务')
  await page.evaluate(
    (groupId) => (window as unknown as DevhubWindow).devhub.startGroup(groupId),
    group.id
  )
  await expect
    .poll(async () => {
      const runs = await page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())
      return runs.some(
        (run) => run.kind === 'script' && run.status !== 'exited' && run.scriptId === 'npm:tick'
      )
    })
    .toBe(true)
  await card.getByRole('button', { name: '立即执行 定时批量执行' }).click()
  await expect(card).toContainText('已跳过')
  await page.evaluate(
    (groupId) => (window as unknown as DevhubWindow).devhub.stopGroup(groupId),
    group.id
  )
  await card.getByRole('button', { name: '立即执行 定时批量执行' }).click()
  await expect(card).toContainText('已触发')
  await page.evaluate(
    (groupId) => (window as unknown as DevhubWindow).devhub.stopGroup(groupId),
    group.id
  )
})
