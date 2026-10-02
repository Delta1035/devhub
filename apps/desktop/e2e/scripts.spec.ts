import { rm } from 'fs/promises'
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
