import { addProjectViaApi, packageJson, test, expect, type DevhubWindow } from './fixtures'

const openSettings = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
}

test('settings apply at once and survive a restart', async ({ launchDevhub, createProject }) => {
  const dir = await createProject('app', { 'package.json': packageJson({ dev: 'node -v' }) })
  let { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await openSettings(page)

  // Theme: a fixed choice overrides the OS.
  await page.getByRole('radio', { name: '深色' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Default shell: pick the last detected one (PowerShell / cmd on Windows, sh… on Linux).
  const shellSelect = page.getByLabel('默认 shell')
  const options = await shellSelect
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean))
  const chosen = options.at(-1)!
  await shellSelect.selectOption(chosen)

  await page.getByLabel('字号').fill('18')
  await page.getByLabel('字号').press('Enter')
  await page.getByLabel('停止等待时间').fill('9')
  await page.getByLabel('停止等待时间').press('Enter')
  await expect
    .poll(() => page.evaluate(() => (window as unknown as DevhubWindow).devhub.getSettings()))
    .toMatchObject({ defaultShell: chosen, stopGraceSeconds: 9 })

  // Back to the project: "+" now opens the chosen shell, at the chosen font size.
  await page.getByRole('button', { name: '返回' }).click()
  await page.getByRole('button', { name: '新建终端' }).click()
  await expect
    .poll(async () =>
      (await page.evaluate(() => (window as unknown as DevhubWindow).devhub.listRuns())).map(
        (run) => run.kind === 'shell' && run.shellId
      )
    )
    .toEqual([chosen])
  await expect
    .poll(() =>
      page.locator('.xterm-rows').evaluate((rows) => parseFloat(getComputedStyle(rows).fontSize))
    )
    .toBe(18)

  await app.close()
  ;({ app, page } = await launchDevhub())
  await expect(page.locator('html')).toHaveClass(/dark/)
  await openSettings(page)
  await expect(page.getByLabel('默认 shell')).toHaveValue(chosen)
  await expect(page.getByLabel('停止等待时间')).toHaveValue('9')
  await expect(page.getByLabel('字号')).toHaveValue('18')
})

test('a chosen editor path is used, and can be reset to auto-detection', async ({
  launchDevhub
}) => {
  const { app, page } = await launchDevhub()
  await openSettings(page)
  // Any existing executable will do; the picker is the native dialog, stubbed here.
  const executable = await app.evaluate(({ dialog }) => {
    Object.assign(dialog, {
      showOpenDialog: async () => ({ canceled: false, filePaths: [process.execPath] })
    })
    return process.execPath
  })

  const editors = page.getByRole('region', { name: '编辑器' })
  await editors.getByRole('button', { name: '选择 IntelliJ IDEA 的路径' }).click()
  await expect(editors).toContainText(`手动指定：${executable}`)

  await editors.getByRole('button', { name: 'IntelliJ IDEA 恢复自动检测' }).click()
  await expect(editors).not.toContainText(`手动指定：${executable}`)
})

test('"quit on close" ends DevHub when the window is closed', async ({ launchDevhub }) => {
  const { app, page } = await launchDevhub()
  await openSettings(page)
  await page.getByRole('radio', { name: '退出' }).click()
  await expect(page.getByText('退出 DevHub，并停止所有脚本和终端')).toBeVisible()

  const exited = new Promise<void>((resolve) => app.process().once('exit', () => resolve()))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close())
  await expect(exited).resolves.toBeUndefined()
})
