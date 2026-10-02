import type { ElectronApplication, Page } from '@playwright/test'
import { addProjectViaApi, packageJson, test, expect } from './fixtures'

const readClipboard = (app: ElectronApplication) =>
  app.evaluate(({ clipboard }) => clipboard.readText())

const run = async (page: Page, command: string): Promise<void> => {
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
}

/** Opens a project with a fresh default shell (bash on both CI platforms) and focuses it. */
const openShell = async (
  launchDevhub: () => Promise<{ app: ElectronApplication; page: Page }>,
  dir: string
) => {
  const { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await page.getByRole('button', { name: '新建终端' }).click()
  await expect(page.locator('.xterm-rows')).toContainText('$')
  await page.locator('.xterm').click()
  return { app, page, terminal: page.locator('.xterm-rows') }
}

test('copies with Ctrl+C only when text is selected, otherwise interrupts; pastes with Ctrl+V', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', { 'package.json': packageJson({ dev: 'node -v' }) })
  const { app, page, terminal } = await openShell(launchDevhub, dir)

  await run(page, 'echo copy-me-$((40+2))')
  // xterm's DOM rows re-render constantly, so click by position instead of waiting for a
  // "stable" element; double-click selects the word.
  const output = page.locator('.xterm-rows > div', { hasText: /^copy-me-42\s*$/ })
  await expect(output).toHaveCount(1)
  const box = await output.boundingBox()
  if (!box) throw new Error('output row has no box')
  await page.mouse.dblclick(box.x + 20, box.y + box.height / 2)
  await page.keyboard.press('Control+c')
  await expect.poll(() => readClipboard(app)).toBe('copy-me-42')

  // No selection now: Ctrl+C must reach the running program and interrupt it.
  await run(page, 'node -e "setInterval(() => {}, 1000)"')
  await page.waitForTimeout(1000)
  await page.keyboard.press('Control+c')
  await run(page, 'echo after-$((1+1))')
  await expect(terminal).toContainText('after-2')

  await app.evaluate(({ clipboard }) => clipboard.writeText('echo pasted-$((2+3))'))
  await page.keyboard.press('Control+v')
  // Pasting reads the clipboard asynchronously; wait for the text before pressing Enter.
  await expect(terminal).toContainText('echo pasted-$((2+3))')
  await page.keyboard.press('Enter')
  await expect(terminal).toContainText('pasted-5')
})

test('keeps a terminal alive across tab switches; search, clear, zoom and maximize', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', { 'package.json': packageJson({ dev: 'node -v' }) })
  const { page, terminal } = await openShell(launchDevhub, dir)

  await run(page, 'echo marker-$((7*6))')
  await expect(terminal).toContainText('marker-42')

  // Tag the xterm element; seeing the tag after switching back proves the same instance.
  await page.locator('.xterm').evaluate((element) => element.setAttribute('data-e2e', 'kept'))
  await page.getByRole('button', { name: '新建终端' }).click()
  await expect(page.getByRole('button', { name: '终端 2', exact: true })).toBeVisible()
  await expect(page.locator('.xterm[data-e2e="kept"]')).toHaveCount(0)
  await page.getByRole('button', { name: '终端 1', exact: true }).click()
  await expect(page.locator('.xterm[data-e2e="kept"]')).toHaveCount(1)
  await expect(terminal).toContainText('marker-42')

  // Search: the term appears in the typed command line and in the output.
  await page.locator('.xterm').click()
  await page.keyboard.press('Control+f')
  const search = page.getByRole('search')
  await search.getByLabel('搜索终端输出').fill('marker-')
  await expect(search).toContainText(/\d\/2/)
  await page.keyboard.press('Escape')
  await expect(search).toBeHidden()

  await page.keyboard.press('Control+Shift+K')
  await expect(terminal).not.toContainText('marker-42')

  // Zoom changes the font of every terminal and is remembered. (After the clear: on Windows
  // ConPTY repaints its own screen copy on resize, which can bring cleared lines back.)
  const fontSize = () =>
    page.locator('.xterm-rows').evaluate((rows) => parseFloat(getComputedStyle(rows).fontSize))
  const before = await fontSize()
  await page.keyboard.press('Control+=')
  await expect.poll(fontSize).toBeGreaterThan(before)
  await page.keyboard.press('Control+0')
  await expect.poll(fontSize).toBe(before)

  await page.getByRole('button', { name: '最大化终端面板' }).click()
  await expect(page.getByText('npm run dev')).toBeHidden()
  await page.getByRole('button', { name: '还原终端面板' }).click()
  await expect(page.getByText('npm run dev')).toBeVisible()
})
