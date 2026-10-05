import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Page } from '@playwright/test'
import { addFromMenu, packageJson, stubFolderPicker, test, expect } from './fixtures'

const manifest = packageJson({ dev: 'node -v' })

/** A sidebar project entry (its accessible name starts with the project name). */
const projectButton = (page: Page, name: string) =>
  page.locator('aside').getByRole('button', { name: new RegExp(`^${name}`) })

test('a workspace discovers projects, follows changes on disk, excludes, restores and is removed', async ({
  launchDevhub,
  createProject
}) => {
  const code = await createProject('code', {
    'web/package.json': manifest,
    'api/package.json': manifest,
    'docs/README.md': '# not a project',
    'group/nested/package.json': manifest
  })
  const addProjectDir = async (relative: string): Promise<void> => {
    await mkdir(join(code, relative), { recursive: true })
    await writeFile(join(code, relative, 'package.json'), manifest)
  }

  const first = await launchDevhub()
  let { page } = first
  await stubFolderPicker(first.app, code)
  await addFromMenu(page, '添加工作区')

  // Depth 1 (the default): direct children with a build file only.
  const section = page.getByRole('region', { name: '工作区 code' })
  await expect(section.getByRole('button', { name: /^web/ })).toBeVisible()
  await expect(section.getByRole('button', { name: /^api/ })).toBeVisible()
  await expect(projectButton(page, 'docs')).toHaveCount(0)
  await expect(projectButton(page, 'nested')).toHaveCount(0)

  await projectButton(page, 'web').click()
  await expect(page.getByRole('heading', { name: 'web' })).toBeVisible()

  // A project created outside DevHub shows up on rescan.
  await addProjectDir('admin')
  await page.getByRole('button', { name: '重新扫描 code' }).click()
  await expect(projectButton(page, 'admin')).toBeVisible()

  // Removing a discovered project excludes it; the settings dialog can bring it back.
  await page.getByRole('button', { name: '移除 api' }).click()
  await expect(page.getByRole('dialog')).toContainText('在此工作区中排除')
  await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click()
  await expect(projectButton(page, 'api')).toHaveCount(0)

  await page.getByRole('button', { name: 'code 工作区设置' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('list', { name: '已排除的项目' })).toContainText('api')
  const depth = dialog.getByRole('combobox', { name: '扫描层数' })
  await depth.selectOption('2')
  await expect(depth).toHaveValue('2')
  await expect(depth).toBeEnabled()
  await dialog.getByRole('button', { name: '恢复 api' }).click()
  await expect(dialog.getByText('没有排除的项目')).toBeVisible()
  // The modal hides the sidebar from the accessibility tree; check it once closed.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(projectButton(page, 'nested')).toBeVisible()
  await expect(projectButton(page, 'api')).toBeVisible()

  // Changes made while DevHub is closed are picked up on the next start.
  await first.app.close()
  await addProjectDir('late')
  page = (await launchDevhub()).page
  await expect(projectButton(page, 'late')).toBeVisible()
  await expect(projectButton(page, 'nested')).toBeVisible()

  await page.getByRole('button', { name: 'code 工作区设置' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '移除工作区' }).click()
  await expect(page.getByRole('dialog')).toContainText('将同时移除其中的 5 个项目')
  await page.getByRole('dialog').getByRole('button', { name: '确认移除' }).click()
  await expect(page.getByText('还没有项目')).toBeVisible()
})
