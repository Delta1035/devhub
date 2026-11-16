import { addProjectViaApi, expect, packageJson, test } from './fixtures'

test('switches feature navigation and manages a running script from the running view', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('navigation-app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': 'setInterval(() => {}, 1000)'
  })
  const { page } = await launchDevhub()
  await addProjectViaApi(page, dir)

  const navigation = page.getByRole('navigation', { name: '功能导航' })
  await expect(navigation.getByRole('button', { name: '项目', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(page.getByRole('region', { name: '项目列表' })).toBeVisible()
  await expect(
    page.locator('aside').getByRole('button', { name: '远程访问', exact: true })
  ).toHaveCount(0)
  await expect(
    page.locator('aside').getByRole('button', { name: '系统设置', exact: true })
  ).toHaveCount(0)

  await navigation.getByRole('button', { name: '批量', exact: true }).click()
  await expect(page.getByRole('heading', { name: '批量任务', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: '批量', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )

  await navigation.getByRole('button', { name: '项目', exact: true }).click()
  await page
    .getByRole('region', { name: '项目列表' })
    .getByRole('button', { name: /^navigation-app/ })
    .click()
  await page.getByRole('button', { name: '运行 tick' }).click()

  await navigation.getByRole('button', { name: '运行中', exact: true }).click()
  await expect(page.getByRole('heading', { name: '运行中', exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: '查看运行中的 navigation-app · tick' })
  ).toBeVisible()
  await expect(navigation.getByRole('button', { name: '运行中', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )

  await page.getByRole('button', { name: '停止运行中的 navigation-app · tick' }).click()
  await expect(page.getByRole('status', { name: '运行中空状态' })).toBeVisible()
})
