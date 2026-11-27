import {
  addProjectViaApi,
  freePort,
  packageJson,
  test,
  expect,
  type DevhubWindow
} from '../support/fixtures'
import { enableRemote, openWebApp } from '../support/web-app'

const phone = { width: 375, height: 812 }

test('on a phone-sized screen the web app uses a drawer and still drives scripts', async ({
  launchDevhub,
  createProject
}, testInfo) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js':
      "for (let n = 1; n <= 60; n++) console.log('tick ' + n)\nsetInterval(() => {}, 1000)\n"
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
        executionKind: 'oneShot',
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
  expect(
    await web.evaluate(() =>
      document.querySelector('meta[name="viewport"]')?.getAttribute('content')
    )
  ).toContain('interactive-widget=resizes-content')

  // The mobile status summary is a floating action instead of a fixed footer.
  await expect(web.getByRole('button', { name: '展开系统状态' })).toBeVisible()
  await expect(web.getByRole('contentinfo')).toHaveCount(0)

  // The sidebar is a drawer, closed once a project is chosen.
  let rescans = 0
  web.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/rescanWorkspaces') rescans++
  })
  const slowDrawerAnimation = await web.addStyleTag({
    content: '[data-slot="sheet-content"][data-state="open"] { animation-duration: 2s !important; }'
  })
  await web.getByRole('button', { name: '打开导航' }).click()
  const drawer = web.getByRole('dialog', { name: '导航' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('status', { name: '正在准备导航' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: '项目', exact: true })).toHaveCount(0)
  await web.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await web.getByRole('button', { name: '打开导航' }).click()
  await expect(drawer.getByRole('status', { name: '正在准备导航' })).toBeVisible()
  expect(rescans).toBe(0)
  await drawer.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  )
  await expect(drawer.getByRole('button', { name: '项目', exact: true })).toBeVisible()
  await slowDrawerAnimation.evaluate((element) => element.parentNode?.removeChild(element))
  await web.screenshot({ path: testInfo.outputPath('phone-drawer.png') })
  // The drawer only contains feature navigation; touch project actions stay in the content area.
  await drawer.getByRole('button', { name: '项目', exact: true }).click()
  await expect(drawer).toBeHidden()
  const projectList = web.getByRole('region', { name: '项目列表' })
  await projectList.getByRole('button', { name: 'app 的更多操作' }).click()
  await expect(web.getByRole('menuitem', { name: '移除…' })).toHaveCount(0)
  await web.getByRole('menuitem', { name: '显示详情' }).click()
  const details = web.getByRole('dialog', { name: '项目详情' })
  await expect(details).toContainText(dir)
  await web.keyboard.press('Escape')
  await expect(details).toBeHidden()

  await projectList.getByRole('button', { name: /^other(?! 的)/ }).click()
  await expect(web.locator('main li', { hasText: 'npm run dev' })).toBeVisible()
  await web.getByRole('button', { name: '打开导航' }).click()
  await drawer.getByRole('button', { name: '项目', exact: true }).click()
  expect(rescans).toBe(0)
  await projectList.getByRole('button', { name: /^app(?! 的)/ }).click()

  await web.getByRole('button', { name: '运行 tick' }).click()
  await expect(tickRow.getByText('运行中')).toBeVisible()
  await web.getByRole('button', { name: '查看 tick 终端' }).click()
  await expect(web.locator('.xterm-rows')).toContainText('tick 60')
  const terminalRows = web.locator('.xterm-rows')
  const terminal = web.locator('[data-terminal-run]')
  const box = await terminal.boundingBox()
  if (!box) throw new Error('terminal has no bounding box')
  const cdp = await web.context().newCDPSession(web)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  // Synthetic CDP touches do not continue after xterm captures the pointer.
  await web.evaluate(() => {
    Element.prototype.setPointerCapture = () => undefined
    Element.prototype.releasePointerCapture = () => undefined
    Element.prototype.hasPointerCapture = () => false
  })
  const y = Math.floor(box.y + box.height * 0.8)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: Math.floor(box.x + box.width / 2), y, id: 1 }]
  })
  for (let step = 1; step <= 6; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.floor(box.x + box.width / 2), y: y - step * 40, id: 1 }]
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(terminalRows).not.toContainText('tick 60')
  await expect(terminalRows).toContainText(/tick (?:[1-9]|[1-5][0-9])/)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp.detach()
  await web.screenshot({ path: testInfo.outputPath('phone-running.png') })

  await web.getByRole('button', { name: '展开系统状态' }).click()
  const mobileStatus = web.getByRole('dialog', { name: '系统状态详情' })
  await expect(mobileStatus).toContainText('1 个运行中')
  await expect(mobileStatus.getByRole('button', { name: '查看运行中任务' })).toBeVisible()
  await web.keyboard.press('Escape')
  await expect(mobileStatus).toBeHidden()
  await web.getByRole('button', { name: /^脚本/ }).click()
  await web.getByRole('button', { name: '停止 tick' }).click()
  await expect(tickRow.getByText('已停止')).toBeVisible()

  // Groups are the drawer's other tab.
  await web.getByRole('button', { name: '打开导航' }).click()
  await drawer.getByRole('button', { name: '批量', exact: true }).click()
  await expect(drawer).toBeHidden()
  await web
    .getByRole('region', { name: '批量任务' })
    .getByRole('button', { name: '查看 全部启动' })
    .click()
  await expect(web.getByRole('heading', { name: '全部启动' })).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('phone-group.png') })

  await web.getByRole('button', { name: '设置', exact: true }).click()
  await expect(web.getByRole('region', { name: '外观' })).toBeVisible()
  await web.screenshot({ path: testInfo.outputPath('phone-settings.png'), fullPage: true })
  // Nothing on the page is wider than the screen.
  expect(await web.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    phone.width
  )

  await desktop.app.close()
})
