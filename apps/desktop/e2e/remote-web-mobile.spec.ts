import {
  addProjectViaApi,
  freePort,
  packageJson,
  test,
  expect,
  type DevhubWindow
} from './fixtures'
import { enableRemote, openWebApp } from './web-app'

const phone = { width: 375, height: 812 }

test('on a phone-sized screen the web app uses a drawer and still drives scripts', async ({
  launchDevhub,
  createProject
}, testInfo) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': "let n = 0\nsetInterval(() => console.log('tick ' + ++n), 200)\n"
  })
  const other = await createProject('other', { 'package.json': packageJson({ dev: 'vite' }) })
  const desktop = await launchDevhub()
  await addProjectViaApi(desktop.page, dir)
  await addProjectViaApi(desktop.page, other)
  await desktop.page.evaluate(async () => {
    const { devhub } = window as unknown as DevhubWindow
    const projects = await devhub.listProjects()
    await devhub.saveGroup({
      name: '全部启动',
      mode: 'serial',
      steps: projects.map((project) => ({
        projectId: project.id,
        scriptId: project.name === 'app' ? 'npm:tick' : 'npm:dev',
        continueWhen: { type: 'exit', timeoutSeconds: 120 }
      }))
    })
  })
  const port = await freePort()
  const remote = await enableRemote(desktop.page, port)

  const web = await openWebApp(desktop, `http://127.0.0.1:${port}/#token=${remote.token}`, phone)
  await web.evaluate(() => localStorage.setItem('devhub.terminalRenderer', 'dom'))
  await web.reload()
  const tickRow = web.locator('main li', { hasText: 'npm run tick' })
  await expect(tickRow).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('phone-project.png') })

  // Installable: the manifest opens the app at the root, without the token in the address.
  const manifest: unknown = await web.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    return link ? (await fetch(link.href)).json() : null
  })
  expect(manifest).toMatchObject({ start_url: './', scope: './', display: 'standalone' })

  // The sidebar is a drawer, closed once a project is chosen.
  await web.getByRole('button', { name: '打开导航' }).click()
  const drawer = web.getByRole('dialog', { name: '导航' })
  await expect(drawer).toBeVisible()
  await drawer.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  )
  await web.screenshot({ path: testInfo.outputPath('phone-drawer.png') })
  // Touch screens have no right click: the same actions sit behind a "more" button.
  await drawer.getByRole('button', { name: 'app 的更多操作' }).click()
  await expect(web.getByRole('menuitem', { name: '移除…' })).toHaveCount(0)
  await web.getByRole('menuitem', { name: '显示详情' }).click()
  const details = web.getByRole('dialog', { name: '项目详情' })
  await expect(details).toContainText(dir)
  await web.keyboard.press('Escape')
  await expect(details).toBeHidden()

  await drawer.getByRole('button', { name: /^other(?! 的)/ }).click()
  await expect(drawer).toBeHidden()
  await expect(web.locator('main li', { hasText: 'npm run dev' })).toBeVisible()
  await web.getByRole('button', { name: '打开导航' }).click()
  await drawer.getByRole('button', { name: /^app(?! 的)/ }).click()

  await web.getByRole('button', { name: '运行 tick' }).click()
  await expect(tickRow.getByText('运行中')).toBeVisible()
  await expect(web.locator('.xterm-rows')).toContainText('tick 2')
  await web.screenshot({ path: testInfo.outputPath('phone-running.png') })
  await web.getByRole('button', { name: '停止 tick' }).click()
  await expect(tickRow.getByText('已停止')).toBeVisible()

  // Groups are the drawer's other tab.
  await web.getByRole('button', { name: '打开导航' }).click()
  await drawer.getByRole('tab', { name: '批量' }).click()
  await drawer.getByRole('button', { name: '查看 全部启动' }).click()
  await expect(drawer).toBeHidden()
  await expect(web.getByRole('heading', { name: '全部启动' })).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('phone-group.png') })

  await web.getByRole('button', { name: '设置' }).click()
  await expect(web.getByRole('region', { name: '外观' })).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('phone-settings.png'), fullPage: true })
  // Nothing on the page is wider than the screen.
  expect(await web.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    phone.width
  )

  await desktop.app.close()
})
