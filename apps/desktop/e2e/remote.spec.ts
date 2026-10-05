import { createServer } from 'net'
import { test, expect } from './fixtures'

/** A port that was free a moment ago. */
const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0))
    })
  })

const listRuns = (port: number, token: string): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/api/v1/listRuns`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  })

test('remote access is set up in settings and serves the API with its token', async ({
  launchDevhub
}) => {
  const { app, page } = await launchDevhub()
  const port = await freePort()
  await page.getByRole('button', { name: '设置' }).click()
  const section = page.getByRole('region', { name: '远程访问' })
  await expect(section.getByRole('status')).toHaveText('关闭时不监听任何端口')

  await section.getByLabel('监听地址').selectOption('127.0.0.1')
  await section.getByLabel('端口').fill(String(port))
  await section.getByLabel('端口').press('Enter')
  const enabled = section.getByRole('radiogroup', { name: '允许手机远程访问' })
  await enabled.getByRole('radio', { name: '开启' }).click()
  await expect(section.getByRole('status')).toHaveText(`监听中：127.0.0.1:${port}`)

  // The token is hidden until asked for.
  const tokenText = section.getByLabel('访问令牌内容')
  await expect(tokenText).toHaveText(/^•+$/)
  await section.getByRole('button', { name: '显示', exact: true }).click()
  const token = (await tokenText.textContent())!
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(await (await listRuns(port, token)).json()).toEqual({ ok: true, value: [] })
  expect((await listRuns(port, 'wrong')).status).toBe(401)

  await section.getByRole('button', { name: '显示二维码' }).click()
  await expect(section.getByRole('img', { name: '连接二维码' })).toBeVisible()
  await expect(section.getByText(`http://127.0.0.1:${port}/#token=…`)).toBeVisible()

  // A new token locks out the old one immediately.
  await section.getByRole('button', { name: '重新生成…' }).click()
  await section.getByRole('button', { name: '确认重新生成' }).click()
  await expect(tokenText).not.toHaveText(token)
  const newToken = (await tokenText.textContent())!
  expect((await listRuns(port, token)).status).toBe(401)
  expect((await listRuns(port, newToken)).status).toBe(200)

  await enabled.getByRole('radio', { name: '关闭' }).click()
  await expect(section.getByRole('status')).toHaveText('关闭时不监听任何端口')
  await expect(listRuns(port, newToken)).rejects.toThrow()

  await app.close()
})
