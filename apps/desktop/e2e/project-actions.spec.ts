import { addProjectViaApi, packageJson, test, expect } from './fixtures'

test('project hover details, context menu actions and a resizable sidebar', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('a-project-with-a-rather-long-name', {
    'package.json': packageJson({ dev: 'node -v', build: 'node -v' })
  })
  const { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  const item = page.locator('aside').getByRole('button', { name: /^a-project-with/ })

  // Hovering shows the details card.
  await item.hover()
  const card = page.locator('[data-slot="hover-card-content"]')
  await expect(card).toContainText(dir)
  await expect(card).toContainText('手动添加')
  await expect(card).toContainText('2 个（npm 2）')
  await page.mouse.move(600, 400)
  await expect(card).toBeHidden()

  // Context menu → details dialog.
  await item.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '显示详情' }).click()
  const details = page.getByRole('dialog', { name: '项目详情' })
  await expect(details).toContainText(dir)
  await page.keyboard.press('Escape')
  await expect(details).toBeHidden()

  // Context menu → open folder, with the OS call stubbed so no file manager appears.
  await app.evaluate(({ shell }) => {
    const opened: string[] = []
    Object.assign(globalThis, { openedFolders: opened })
    Object.assign(shell, {
      openPath: async (path: string) => {
        opened.push(path)
        return ''
      }
    })
  })
  await item.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '打开项目目录' }).click()
  await expect
    .poll(() =>
      app.evaluate(() => (globalThis as unknown as { openedFolders: string[] }).openedFolders)
    )
    .toEqual([dir])

  // Context menu → the editor submenu lists every known editor.
  await item.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '打开方式' }).hover()
  await expect(page.getByRole('menuitem', { name: /VS Code/ })).toBeVisible()
  // Detected per machine, so only the entry itself is checked; launching is unit-tested.
  await expect(page.getByRole('menuitem', { name: /^系统终端（/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // Context menu → a DevHub terminal in a project that is not selected: switches to it.
  const other = await createProject('other', { 'package.json': packageJson({ dev: 'node -v' }) })
  await addProjectViaApi(page, other)
  await page
    .locator('aside')
    .getByRole('button', { name: /^other/ })
    .click()
  await expect(page.getByRole('heading', { name: 'other' })).toBeVisible()
  await item.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '在 DevHub 终端中打开' }).click()
  await expect(page.getByRole('heading', { name: /^a-project-with/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '终端 1', exact: true })).toBeVisible()
  await expect(page.locator('aside').getByRole('status', { name: '1 个活动终端' })).toBeVisible()
  await page.getByRole('button', { name: '关闭 终端 1' }).click()
  await expect(page.getByRole('button', { name: '终端 1', exact: true })).toBeHidden()

  // Context menu → remove still asks first.
  await item.click({ button: 'right' })
  await page.getByRole('menuitem', { name: '移除…' }).click()
  await expect(page.getByRole('dialog', { name: /^移除项目/ })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(item).toBeVisible()

  // Dragging the handle widens the sidebar; the width survives a reload; double-click resets.
  const aside = page.locator('aside')
  const handle = page.getByRole('separator', { name: '调整侧栏宽度' })
  const before = (await aside.boundingBox())?.width ?? 0
  const box = await handle.boundingBox()
  if (!box) throw new Error('resize handle not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await aside.boundingBox())?.width).toBeGreaterThan(before + 100)

  await page.reload()
  await expect.poll(async () => (await aside.boundingBox())?.width).toBeGreaterThan(before + 100)
  await page.getByRole('separator', { name: '调整侧栏宽度' }).dblclick()
  await expect.poll(async () => (await aside.boundingBox())?.width).toBe(before)
})
