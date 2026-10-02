import { rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { addProjectViaApi, packageJson, test, expect } from './fixtures'

test('lists detected scripts with the package manager from the lockfile', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('web-app', {
    'package.json': packageJson({ dev: 'vite --port 5173', build: 'vite build' }),
    'pnpm-lock.yaml': ''
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: 'npm' })).toContainText('pnpm')
  await expect(main.getByText('pnpm run dev')).toBeVisible()
  await expect(main.getByText('vite --port 5173')).toBeVisible()
  await expect(main.getByText('pnpm run build')).toBeVisible()
})

test('flags a project whose directory was deleted', async ({ launchDevhub, createProject }) => {
  const dir = await createProject('gone', { 'package.json': packageJson({ dev: 'node -v' }) })
  let { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  await expect(page.getByText('npm run dev')).toBeVisible()
  await app.close()

  await rm(dir, { recursive: true, force: true })
  ;({ app, page } = await launchDevhub())
  await expect(page.getByText('项目目录不存在')).toBeVisible()
})

test('runs custom scripts from .devhub.yaml and points at mistakes in it', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('mono', {
    '.devhub.yaml': [
      'scripts:',
      '  mock:',
      '    command: node mock.js',
      '    cwd: tools',
      '    description: 本地 mock 服务'
    ].join('\n'),
    'tools/mock.js': 'console.log("mock from " + require("path").basename(process.cwd()))'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const main = page.locator('main')
  await expect(main.getByRole('heading', { name: '自定义' })).toBeVisible()
  await expect(main.getByText('本地 mock 服务')).toBeVisible()
  await page.getByRole('button', { name: '运行 mock' }).click()
  await expect(page.locator('.xterm-rows')).toContainText('mock from tools')

  await writeFile(join(dir, '.devhub.yaml'), 'scripts:\n  mock:\n    command: "oops\n')
  await page.getByRole('button', { name: '刷新' }).click()
  await expect(main.getByText(/自定义：\.devhub\.yaml 第 \d+ 行不是有效的 YAML/)).toBeVisible()
})
