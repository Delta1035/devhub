import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { runHistoryOutputLimit } from '@devhub/shared'
import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from './fixtures'

test('retains capped history logs across restart, clears ended logs, and cleans removed projects', async ({
  launchDevhub,
  createProject,
  workDir
}) => {
  const dir = await createProject('history-app', {
    'package.json': packageJson({ logs: 'node log.js', serve: 'node serve.js' }),
    'log.js': `process.stdout.write('x'.repeat(600 * 1024) + '\\nLOG_END 中文🙂\\n', () => process.exit(3))`,
    'serve.js': `console.log('SERVER_LOG'); setInterval(() => {}, 1000)`
  })
  const first = await launchDevhub()
  let { page } = first
  await addProjectViaApi(page, dir)
  await page.getByRole('button', { name: '运行 logs', exact: true }).click()
  await expect(
    page.locator('main li', { hasText: 'npm run logs' }).getByText('退出码 3')
  ).toBeVisible()
  const ids = await page.evaluate(async () => {
    const api = (window as unknown as DevhubWindow).devhub
    const project = (await api.listProjects())[0]!
    const record = (await api.listRunHistory(project.id, 'npm:logs'))[0]!
    const log = await api.getRunHistoryOutput(project.id, 'npm:logs', record.runId)
    return { projectId: project.id, runId: record.runId, log }
  })
  expect(ids.log?.truncated).toBe(true)
  expect(Buffer.byteLength(ids.log?.data ?? '', 'utf8')).toBeLessThanOrEqual(runHistoryOutputLimit)
  expect(ids.log?.data).toContain('LOG_END 中文🙂')
  await first.app.close()
  page = (await launchDevhub()).page
  await page.getByRole('button', { name: 'logs 的运行历史' }).click()
  await page
    .getByRole('dialog', { name: 'logs 的运行历史' })
    .getByRole('button', { name: '查看日志' })
    .click()
  const logDialog = page.getByRole('dialog', { name: 'logs 的历史日志' })
  await expect(logDialog).toContainText('日志已截断')
  await expect(logDialog.getByLabel('历史日志内容')).toContainText('LOG_END 中文🙂')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '运行 serve', exact: true }).click()
  await expect(page.locator('.xterm-rows')).toContainText('SERVER_LOG')
  await page.getByRole('button', { name: 'logs 的运行历史' }).click()
  const history = page.getByRole('dialog', { name: 'logs 的运行历史' })
  await history.getByRole('button', { name: '清空历史' }).click()
  await expect(history.getByRole('listitem')).toHaveCount(0)
  const logFile = join(
    workDir,
    'userdata',
    'history-logs',
    `${createHash('sha256').update(ids.runId).digest('hex')}.json`
  )
  await expect
    .poll(async () =>
      readFile(logFile, 'utf8').then(
        () => false,
        () => true
      )
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '停止 serve', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '停止 serve', exact: true }).click()
  await page.getByRole('button', { name: 'serve 的运行历史' }).click()
  await expect(
    page.getByRole('dialog', { name: 'serve 的运行历史' }).getByRole('listitem')
  ).toHaveCount(1)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '移除 history-app', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click()
  await expect(page.getByRole('button', { name: '移除 history-app', exact: true })).toBeHidden()
  await expect
    .poll(async () => (await readdir(join(workDir, 'userdata', 'history-logs'))).length)
    .toBe(0)
  const file = JSON.parse(
    await readFile(join(workDir, 'userdata', 'run-history.json'), 'utf8')
  ) as { records: unknown[] }
  expect(file.records).toEqual([])
})

test('recovers history and checkpointed logs after an actual application crash', async ({
  launchDevhub,
  createProject,
  workDir
}) => {
  const dir = await createProject('crash-app', {
    'package.json': packageJson({ serve: 'node server.js' }),
    'server.js': `console.log('CRASH_LOG 中文'); setInterval(() => {}, 1000)`
  })
  const first = await launchDevhub()
  await addProjectViaApi(first.page, dir)
  await first.page.getByRole('button', { name: '运行 serve', exact: true }).click()
  await expect(first.page.locator('.xterm-rows')).toContainText('CRASH_LOG 中文')
  // Wait on the checkpoint file, then exit without before-quit/core.dispose cleanup.
  await expect
    .poll(async () => {
      const directory = join(workDir, 'userdata', 'history-logs')
      const files = await readdir(directory).catch(() => [] as string[])
      for (const file of files.filter((name) => name.endsWith('.json'))) {
        const data = await readFile(join(directory, file), 'utf8').catch(() => '')
        if (data.includes('CRASH_LOG')) return true
      }
      return false
    })
    .toBe(true)
  const electronProcess = first.app.process()
  await first.app.evaluate(({ app }) => app.exit(1)).catch(() => undefined)
  await expect.poll(() => electronProcess.exitCode).not.toBeNull()
  const { page } = await launchDevhub()
  const leftovers = page.getByRole('alert').filter({ hasText: '遗留' })
  if (await leftovers.count()) await leftovers.getByRole('button', { name: '全部结束' }).click()
  await page.getByRole('button', { name: 'serve 的运行历史' }).click()
  const history = page.getByRole('dialog', { name: 'serve 的运行历史' })
  await expect(history.getByRole('listitem')).toContainText('异常中断')
  await expect(history.getByRole('listitem')).toContainText('时长未知')
  const records = await page.evaluate(async () => {
    const api = (window as unknown as DevhubWindow).devhub
    return api.listRunHistory((await api.listProjects())[0]!.id, 'npm:serve')
  })
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({
    status: 'interrupted',
    endedAt: null,
    exitCode: null,
    stopped: false
  })
  await history.getByRole('button', { name: '查看日志' }).click()
  await expect(page.getByRole('dialog', { name: 'serve 的历史日志' })).toContainText(
    'CRASH_LOG 中文'
  )
})

test('keeps old history readable and explains unavailable logs', async ({
  launchDevhub,
  createProject,
  workDir
}) => {
  const dir = await createProject('legacy-app', {
    'package.json': packageJson({ check: 'node -v' })
  })
  const userData = join(workDir, 'userdata')
  await mkdir(userData, { recursive: true })
  await writeFile(
    join(userData, 'projects.json'),
    JSON.stringify({
      version: 1,
      projects: [
        {
          id: 'legacy',
          name: 'legacy-app',
          path: dir,
          addedAt: '2026-10-03T00:00:00.000Z'
        }
      ]
    })
  )
  await writeFile(
    join(userData, 'run-history.json'),
    JSON.stringify({
      version: 1,
      records: [
        {
          runId: 'legacy-run',
          projectId: 'legacy',
          scriptId: 'npm:check',
          command: 'node -v',
          startedAt: '2026-10-03T00:00:00.000Z',
          endedAt: '2026-10-03T00:00:01.000Z',
          exitCode: 0,
          stopped: false
        }
      ]
    })
  )
  const { page } = await launchDevhub()
  await page.getByRole('button', { name: 'check 的运行历史' }).click()
  const history = page.getByRole('dialog', { name: 'check 的运行历史' })
  await expect(history).toContainText('已完成')
  await history.getByRole('button', { name: '查看日志' }).click()
  await expect(page.getByRole('dialog', { name: 'check 的历史日志' })).toContainText('日志不可用')
})
