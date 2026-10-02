import { createServer } from 'net'
import { addProjectViaApi, packageJson, test, expect } from './fixtures'

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
  // Listening alone is not enough: the endpoint must answer 2xx.
  await expect(page.locator('.xterm-rows')).toContainText('listening')
  await expect(badge).toHaveText('启动中')
  await expect(badge).toHaveText('就绪', { timeout: 10_000 })

  await page.getByRole('button', { name: '停止 api' }).click()
  await expect(badge).toBeHidden()
  await expect(row.getByText('已停止')).toBeVisible()
})
