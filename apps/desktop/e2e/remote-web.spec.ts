import type { Page } from '@playwright/test'
import type { RemoteState } from '@devhub/shared'
import {
  addProjectViaApi,
  freePort,
  packageJson,
  test,
  expect,
  type DevhubApp,
  type DevhubWindow
} from './fixtures'

const enableRemote = (page: Page, port: number): Promise<RemoteState> =>
  page.evaluate(
    (listenPort) =>
      (window as unknown as DevhubWindow).devhub.updateRemoteConfig({
        enabled: true,
        host: '127.0.0.1',
        port: listenPort
      }),
    port
  )

/**
 * Opens the web app the way a phone's browser would: a window without DevHub's preload bridge,
 * so the renderer has to use the remote server.
 */
async function openWebApp({ app }: DevhubApp, url: string): Promise<Page> {
  const [web] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(({ BrowserWindow }, target) => {
      const window = new BrowserWindow({ width: 1000, height: 800 })
      void window.loadURL(target)
    }, url)
  ])
  return web
}

test('the web app connects with the QR link and drives scripts, without desktop-only actions', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': "let n = 0\nsetInterval(() => console.log('tick ' + ++n), 200)\n"
  })
  const desktop = await launchDevhub()
  await addProjectViaApi(desktop.page, dir)
  const port = await freePort()
  const remote = await enableRemote(desktop.page, port)

  // The link from the QR code; the app keeps the token and clears it from the address bar.
  const web = await openWebApp(desktop, `http://127.0.0.1:${port}/#token=${remote.token}`)
  const tickRow = web.locator('main li', { hasText: 'npm run tick' })
  await expect(tickRow).toBeVisible()
  expect(web.url()).toBe(`http://127.0.0.1:${port}/`)
  // Readable terminal text (see fixtures); reloading also shows the token was kept.
  await web.evaluate(() => localStorage.setItem('devhub.terminalRenderer', 'dom'))
  await web.reload()
  await expect(tickRow).toBeVisible()

  // Started from the phone, visible on the desktop, output streamed back to the phone.
  await web.getByRole('button', { name: '运行 tick' }).click()
  await expect(tickRow.getByText('运行中')).toBeVisible()
  await expect(
    desktop.page.locator('main li', { hasText: 'npm run tick' }).getByText('运行中')
  ).toBeVisible()
  await expect(web.locator('.xterm-rows')).toContainText('tick 2')

  // Actions that change what runs on the host are not offered.
  await expect(web.getByRole('button', { name: '移除 app' })).toHaveCount(0)
  await expect(web.getByRole('button', { name: '新建终端' })).toHaveCount(0)
  await expect(web.getByRole('button', { name: /用 .+ 打开 app/ })).toHaveCount(0)
  await expect(web.getByRole('button', { name: '添加' })).toHaveCount(0)

  await web.getByRole('button', { name: '停止 tick' }).click()
  await expect(tickRow.getByText('已停止')).toBeVisible()

  // Settings keep only what is local to this device.
  await web.getByRole('button', { name: '设置' }).click()
  await expect(web.getByRole('region', { name: '外观' })).toBeVisible()
  await expect(web.getByLabel('停止等待时间')).toHaveCount(0)
  await expect(web.getByRole('region', { name: '远程访问' })).toHaveCount(0)
  await expect(web.getByRole('region', { name: '关于与更新' })).toHaveCount(0)

  // A new token on the desktop sends the phone back to the connect page; pasting it reconnects.
  const renewed: RemoteState = await desktop.page.evaluate(() =>
    (window as unknown as DevhubWindow).devhub.regenerateRemoteToken()
  )
  await expect(web.getByText('访问令牌无效或已重新生成')).toBeVisible()
  await web.getByLabel('访问令牌').fill(renewed.token)
  await web.getByRole('button', { name: '连接' }).click()
  await expect(tickRow).toBeVisible()
  // Live updates resume on the new connection.
  await web.getByRole('button', { name: '运行 tick' }).click()
  await expect(tickRow.getByText('运行中')).toBeVisible()

  await desktop.app.close()
})

test('the web app asks for a token when it has none', async ({ launchDevhub }) => {
  const desktop = await launchDevhub()
  const port = await freePort()
  await enableRemote(desktop.page, port)
  const web = await openWebApp(desktop, `http://127.0.0.1:${port}/`)
  await expect(web.getByRole('heading', { name: '连接 DevHub' })).toBeVisible()
  await web.getByLabel('访问令牌').fill('wrong')
  await web.getByRole('button', { name: '连接' }).click()
  await expect(web.getByText('访问令牌无效或已重新生成')).toBeVisible()
  await desktop.app.close()
})
