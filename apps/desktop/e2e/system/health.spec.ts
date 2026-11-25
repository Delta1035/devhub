import { createServer } from 'net'
import { addProjectViaApi, packageJson, test, expect } from '../support/fixtures'

/** A port nothing listens on yet. */
const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })

test('a server shows as starting, then ready once its health endpoint answers', async ({
  launchDevhub,
  createProject
}) => {
  const port = await freePort()
  // Listens after a delay, and answers /health with 503 for a while before 200.
  const server = `
    const http = require('http')
    const started = Date.now()
    setTimeout(() => {
      http.createServer((req, res) => {
        const ready = Date.now() - started > 2500
        res.writeHead(req.url === '/health' && ready ? 200 : 503).end()
      }).listen(${port}, '127.0.0.1', () => console.log('listening'))
    }, 1000)`
  const dir = await createProject('api', {
    'package.json': packageJson({}),
    'server.js': server,
    '.devhub.yaml': `scripts:\n  api:\n    command: node server.js\n    port: ${port}\n    health: /health\n`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const row = page.locator('main li', { hasText: 'node server.js' })
  await page.getByRole('button', { name: '运行 api' }).click()
  const badge = row.getByTitle(`检查：GET http://localhost:${port}/health`)
  await expect(badge).toHaveText('启动中')
  await page.getByRole('button', { name: '查看 api 终端' }).click()
  // Listening alone is not enough: the endpoint must answer 2xx.
  await expect(page.locator('.xterm-rows')).toContainText('listening')
  await page.getByRole('button', { name: /^脚本/ }).click()
  await expect(badge).toHaveText('启动中')
  await expect(badge).toHaveText('就绪', { timeout: 10_000 })

  await page.getByRole('button', { name: '停止 api' }).click()
  await expect(badge).toBeHidden()
  await expect(row.getByText('已停止')).toBeVisible()
})

test('status bar summarizes multiple healthy runs cleanly and popover identifies alive processes', async ({
  launchDevhub,
  createProject
}) => {
  const port = await freePort()
  const dir = await createProject('multi-status-app', {
    'package.json': packageJson({
      'worker-a': 'node keepalive.js a',
      'worker-b': 'node keepalive.js b'
    }),
    'keepalive.js': 'setInterval(() => {}, 1000)',
    'server.js': `require('http').createServer((_, res) => res.end('ok')).listen(${port}, '127.0.0.1')`,
    '.devhub.yaml': `scripts:\n  web:\n    command: node server.js\n    port: ${port}\n`
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  await page.getByRole('button', { name: '运行 web' }).click()
  await page.getByRole('button', { name: '运行 worker-a' }).click()
  await page.getByRole('button', { name: '运行 worker-b' }).click()

  const statusBar = page.getByRole('status', { name: '系统状态' })
  const healthTrigger = statusBar.getByRole('button', { name: '查看运行健康详情' })
  await expect(healthTrigger).toContainText(`端口 ${port} 就绪`)
  await expect(healthTrigger).toContainText('2 项稳定')
  await expect(statusBar).not.toContainText('进程稳定运行')

  const barBox = await statusBar.boundingBox()
  expect(barBox?.height).toBeLessThanOrEqual(28)

  await healthTrigger.click()
  const popover = page.getByRole('dialog', { name: '运行健康详情列表' })
  await expect(popover).toBeVisible()
  await expect(popover).toContainText('multi-status-app · web')
  await expect(popover).toContainText('multi-status-app · worker-a')
  await expect(popover).toContainText('multi-status-app · worker-b')
  await expect(popover).toContainText('进程稳定运行')
  await expect(popover).toContainText('PID ')

  // Clicking an alive item jumps straight to that script's terminal tab.
  await popover.getByRole('button', { name: /multi-status-app · worker-a/ }).click()
  await expect(popover).toBeHidden()
  await expect(page.getByRole('button', { name: 'worker-a', exact: true })).toHaveAttribute(
    'aria-current',
    'true'
  )

  await page.getByRole('button', { name: /^脚本/ }).click()
  await page.getByRole('button', { name: '停止 web' }).click()
  await page.getByRole('button', { name: '停止 worker-a' }).click()
  await page.getByRole('button', { name: '停止 worker-b' }).click()
})
