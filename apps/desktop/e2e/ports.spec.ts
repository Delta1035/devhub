import { createServer, type Server } from 'net'
import { addProjectViaApi, packageJson, test, expect } from './fixtures'

let blocker: Server | undefined

test.afterEach(async () => {
  await new Promise((resolve) => (blocker ? blocker.close(resolve) : resolve(undefined)))
  blocker = undefined
})

test('warns before starting a script whose port is taken, and can start it anyway', async ({
  launchDevhub,
  createProject
}) => {
  // Hold a free port in the test process, as another dev server would.
  blocker = createServer()
  const port = await new Promise<number>((resolve) =>
    blocker!.listen(0, '127.0.0.1', () => {
      const address = blocker!.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  )
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
  await expect(alert).toContainText(`PID ${process.pid}`)
  await expect(row.getByRole('button', { name: '停止 dev' })).toBeHidden()

  await alert.getByRole('button', { name: '仍然启动' }).click()
  await expect(alert).toBeHidden()
  await expect(row.getByRole('button', { name: '停止 dev' })).toBeVisible()
  await expect(page.locator('.xterm-rows')).toContainText('started anyway')
})
