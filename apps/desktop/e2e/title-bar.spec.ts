import { test, expect } from './fixtures'

test('the title bar replaces the system frame and drives the window', async ({ launchDevhub }) => {
  test.skip(process.platform === 'darwin', 'macOS keeps its own traffic-light buttons')
  const { app, page } = await launchDevhub()
  const windowState = () =>
    app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!
      return {
        maximized: window.isMaximized(),
        minimized: window.isMinimized(),
        visible: window.isVisible()
      }
    })
  const titleBar = page.getByRole('banner')
  await expect(titleBar.getByRole('heading', { name: 'DevHub' })).toBeVisible()

  // xvfb on Linux CI has no window manager, so maximize / minimize never take effect there;
  // a real Linux desktop runs them.
  if (!(process.platform === 'linux' && process.env.CI)) {
    await titleBar.getByRole('button', { name: '最大化' }).click()
    await expect.poll(windowState).toMatchObject({ maximized: true })
    await titleBar.getByRole('button', { name: '还原' }).click()
    await expect.poll(windowState).toMatchObject({ maximized: false })
    await expect(titleBar.getByRole('button', { name: '最大化' })).toBeVisible()

    await titleBar.getByRole('button', { name: '最小化' }).click()
    await expect.poll(windowState).toMatchObject({ minimized: true })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.restore())
  }

  // Default "keep in tray": closing only hides the window, DevHub keeps running.
  await titleBar.getByRole('button', { name: '关闭' }).click()
  await expect.poll(windowState).toMatchObject({ visible: false })
  expect(app.process().exitCode).toBeNull()
})
