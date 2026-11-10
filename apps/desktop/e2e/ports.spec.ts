import type { Page } from '@playwright/test'
import { addProjectViaApi, packageJson, type DevhubWindow } from './fixtures'
import { canBind, hasExited, httpBody, httpServerScript, test, expect } from './port-fixtures'

const enableTermination = async (page: Page) => {
  await page.getByRole('button', { name: '设置' }).click()
  await page.getByLabel('端口被占用时').selectOption({ label: '结束占用进程后启动' })
  await expect
    .poll(() => page.evaluate(() => (window as unknown as DevhubWindow).devhub.getSettings()))
    .toMatchObject({ portConflictPolicy: 'terminate' })
  await page.getByRole('button', { name: '返回' }).click()
}

test('warns before starting a script whose port is taken, and can start it anyway', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const blocker = await listener('original server')
  const { port } = blocker
  const dir = await createProject('web', {
    'package.json': packageJson({ dev: `node server.js --port ${port}` }),
    'server.js': 'console.log("started anyway"); setInterval(() => {}, 1000)'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const row = page.locator('main li', { hasText: 'npm run dev' })
  await expect(row.getByText(`端口 ${port}`)).toBeVisible()

  await page.getByRole('button', { name: '运行 dev' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '端口已被占用' })
  await expect(alert).toContainText(`端口 ${port} 已被`)
  await expect(alert).toContainText(`PID ${blocker.pid}`)
  await expect(row.getByRole('button', { name: '停止 dev' })).toBeHidden()
  expect(hasExited(blocker)).toBe(false)
  expect(await httpBody(port)).toBe('original server')

  await alert.getByRole('button', { name: '仍然启动' }).click()
  await expect(alert).toBeHidden()
  await expect(row.getByRole('button', { name: '停止 dev' })).toBeVisible()
  await expect(page.locator('.xterm-rows')).toContainText('started anyway')
  expect(hasExited(blocker)).toBe(false)
  expect(await httpBody(port)).toBe('original server')
})

test('the global terminate policy replaces a real listener through the run button', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const blocker = await listener('old server')
  const unrelated = await listener('unrelated server')
  const dir = await createProject('web', {
    'package.json': packageJson({
      dev: `node server.js --port ${blocker.port} --body replacement`
    }),
    'server.js': httpServerScript,
    '.devhub.yaml': `scripts:
  web:
    command: npm run dev
    port: ${blocker.port}
`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await enableTermination(page)

  await page.getByRole('button', { name: '运行 web' }).click()
  await expect.poll(() => httpBody(blocker.port)).toBe('replacement')
  await expect.poll(() => hasExited(blocker)).toBe(true)
  await expect(page.getByRole('alert').filter({ hasText: '端口已被占用' })).toBeHidden()
  expect(hasExited(unrelated)).toBe(false)
  expect(await httpBody(unrelated.port)).toBe('unrelated server')

  await page.getByRole('button', { name: '停止 web' }).click()
  await expect.poll(() => canBind(blocker.port)).toBe(true)
  // A second UI start reuses the exact port after the replacement has exited.
  await page.getByRole('button', { name: '运行 web' }).click()
  await expect.poll(() => httpBody(blocker.port)).toBe('replacement')
  await page.getByRole('button', { name: '停止 web' }).click()
  await expect.poll(() => canBind(blocker.port)).toBe(true)
  expect(await httpBody(unrelated.port)).toBe('unrelated server')
})

test('global termination preserves the holder of an inferred npm port', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const blocker = await listener('inferred port owner')
  const dir = await createProject('inferred', {
    'package.json': packageJson({
      dev: `node server.js --port ${blocker.port} --body must-not-start`
    }),
    'server.js': httpServerScript
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await enableTermination(page)
  const row = page.locator('main li', { hasText: 'npm run dev' })
  await expect(row.getByText(`端口 ${blocker.port}`)).toBeVisible()

  await page.getByRole('button', { name: '运行 dev' }).click()
  const alert = page.getByRole('alert').filter({ hasText: '端口已被占用' })
  await expect(alert).toContainText(`端口 ${blocker.port} 已被`)
  await expect(alert).toContainText(`PID ${blocker.pid}`)
  await expect(alert.getByRole('button', { name: '仍然启动' })).toBeVisible()
  await alert.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(alert).toBeHidden()
  await expect(row.getByRole('button', { name: '停止 dev' })).toBeHidden()
  expect(await page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())).toEqual(
    []
  )
  expect(hasExited(blocker)).toBe(false)
  expect(await httpBody(blocker.port)).toBe('inferred port owner')
})

test('a YAML terminate policy replaces the holder while the global default still rejects', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const blocker = await listener('old YAML server')
  const dir = await createProject('custom', {
    'package.json': packageJson({}),
    'server.js': httpServerScript,
    '.devhub.yaml': `scripts:
  api:
    command: node server.js --port ${blocker.port} --body yaml-replacement
    port: ${blocker.port}
    health: /
    portConflictPolicy: terminate
`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  await page.getByRole('button', { name: '运行 api' }).click()
  await expect.poll(() => httpBody(blocker.port)).toBe('yaml-replacement')
  await expect.poll(() => hasExited(blocker)).toBe(true)
  const row = page.locator('main li', { hasText: 'node server.js' })
  await expect(row.getByTitle(`检查：GET http://localhost:${blocker.port}/`)).toHaveText('就绪')
  expect(
    await page.evaluate(() => (window as unknown as DevhubWindow).devhub.getSettings())
  ).toMatchObject({ portConflictPolicy: 'error' })
  await page.getByRole('button', { name: '停止 api' }).click()
  await expect.poll(() => canBind(blocker.port)).toBe(true)
})

test('a YAML replacement stops a managed run before taking over the same port', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const released = await listener('reserve an isolated port')
  const { port } = released
  await released.stop()
  const dir = await createProject('managed', {
    'package.json': packageJson({}),
    'server.js': httpServerScript,
    '.devhub.yaml': `scripts:
  first:
    command: node server.js --port ${port} --body managed-first
    port: ${port}
    health: /
  second:
    command: node server.js --port ${port} --body managed-second
    port: ${port}
    health: /
    portConflictPolicy: terminate
`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await page.getByRole('button', { name: '运行 first' }).click()
  await expect.poll(() => httpBody(port)).toBe('managed-first')

  await page.getByRole('button', { name: '运行 second' }).click()
  await expect.poll(() => httpBody(port)).toBe('managed-second')
  const firstRow = page.locator('main li', { hasText: '--body managed-first' })
  await expect(firstRow.getByText('已停止')).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '停止 first' })).toBeHidden()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns()))
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scriptId: 'custom:first', status: 'exited' }),
        expect.objectContaining({ scriptId: 'custom:second', status: 'running' })
      ])
    )
  await page.getByRole('button', { name: '停止 second' }).click()
  await expect.poll(() => canBind(port)).toBe(true)
})

for (const mode of ['serial', 'parallel'] as const) {
  test(`a ${mode} group replaces only its occupied listeners from the group run button`, async ({
    launchDevhub,
    createProject,
    listener
  }) => {
    const first = await listener('old first')
    const second = await listener('old second')
    const unrelated = await listener('outside the group')
    const dir = await createProject('grouped', {
      'package.json': packageJson({
        first: `node server.js --port ${first.port} --body group-first`,
        second: `node server.js --port ${second.port} --body group-second`
      }),
      'server.js': httpServerScript,
      '.devhub.yaml': `scripts:
  first-server:
    command: npm run first
    port: ${first.port}
  second-server:
    command: npm run second
    port: ${second.port}
`
    })
    const { page } = await launchDevhub()
    await addProjectViaApi(page, dir)
    await enableTermination(page)
    // Standard public API prepares saved data; starting and stopping use the UI.
    await page.evaluate(
      async ({ dir, mode, ports }) => {
        const api = (window as unknown as DevhubWindow).devhub
        const project = (await api.listProjects()).find((project) => project.path === dir)
        if (!project) throw new Error('Fixture project was not registered')
        await api.saveGroup({
          name: 'replace listeners',
          mode,
          steps: ['first', 'second'].map((script, index) => ({
            projectId: project.id,
            scriptId: `custom:${script}-server`,
            continueWhen: {
              type: 'http',
              url: `http://127.0.0.1:${ports[index]}/`,
              timeoutSeconds: 10
            }
          }))
        })
      },
      { dir, mode, ports: [first.port, second.port] }
    )
    await page.reload()
    await page.getByRole('tab', { name: '批量' }).click()
    const item = page.getByRole('listitem', { name: '批量任务 replace listeners' })
    await item.getByRole('button', { name: '执行 replace listeners' }).click()

    // Windows performs verified CIM snapshots for each sequential port takeover.
    await expect(item).toContainText('已完成', { timeout: 35_000 })
    await expect.poll(() => httpBody(first.port)).toBe('group-first')
    await expect.poll(() => httpBody(second.port)).toBe('group-second')
    await expect.poll(() => [hasExited(first), hasExited(second)]).toEqual([true, true])
    expect(hasExited(unrelated)).toBe(false)
    expect(await httpBody(unrelated.port)).toBe('outside the group')

    await item.getByRole('button', { name: '停止 replace listeners' }).click()
    await expect.poll(() => canBind(first.port)).toBe(true)
    await expect.poll(() => canBind(second.port)).toBe(true)
    expect(await httpBody(unrelated.port)).toBe('outside the group')
  })
}

test('terminate mode can reuse a port whose previous holder has already exited', async ({
  launchDevhub,
  createProject,
  listener
}) => {
  const blocker = await listener('already exited')
  const dir = await createProject('reuse', {
    'package.json': packageJson({
      dev: `node server.js --port ${blocker.port} --body reused-port`
    }),
    'server.js': httpServerScript,
    '.devhub.yaml': `scripts:
  web:
    command: npm run dev
    port: ${blocker.port}
`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await enableTermination(page)
  await blocker.stop()
  await expect.poll(() => canBind(blocker.port)).toBe(true)

  await page.getByRole('button', { name: '运行 web' }).click()
  await expect.poll(() => httpBody(blocker.port)).toBe('reused-port')
  await page.getByRole('button', { name: '停止 web' }).click()
  await expect.poll(() => canBind(blocker.port)).toBe(true)
})
