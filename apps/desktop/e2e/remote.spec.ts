import type { IpcResult, RemoteState } from '@devhub/shared'
import {
  addProjectViaApi,
  freePort,
  packageJson,
  test,
  expect,
  type DevhubWindow
} from './fixtures'

const listRuns = (port: number, token: string): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/api/v1/listRuns`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  })

test('a remote client drives scripts over HTTP and follows them over SSE', async ({
  launchDevhub,
  createProject
}) => {
  const dir = await createProject('app', {
    'package.json': packageJson({ tick: 'node tick.js' }),
    'tick.js': "let n = 0\nsetInterval(() => console.log('tick ' + ++n), 200)\n"
  })
  const { app, page } = await launchDevhub()
  await addProjectViaApi(page, dir)
  const port = await freePort()
  const remote: RemoteState = await page.evaluate(
    (listenPort) =>
      (window as unknown as DevhubWindow).devhub.updateRemoteConfig({
        enabled: true,
        host: '127.0.0.1',
        port: listenPort
      }),
    port
  )
  expect(remote.status).toEqual({ state: 'listening', port })

  const base = `http://127.0.0.1:${port}/api/v1`
  const headers = { authorization: `Bearer ${remote.token}`, 'content-type': 'application/json' }
  const call = async (method: string, ...args: unknown[]): Promise<IpcResult<unknown>> =>
    (await fetch(`${base}/${method}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ args })
    }).then((response) => response.json())) as IpcResult<unknown>
  const value = async <T>(method: string, ...args: unknown[]): Promise<T> => {
    const result = await call(method, ...args)
    if (!result.ok) throw new Error(`${method}: ${result.error.message}`)
    return result.value as T
  }

  // Follow events the way a phone would: subscribe first, then act.
  const events = await fetch(`${base}/events`, { headers })
  const reader = events.body!.getReader()
  const decoder = new TextDecoder()
  let received = ''
  const reading = (async () => {
    for (;;) {
      const { value: chunk, done } = await reader.read()
      if (done) return
      received += decoder.decode(chunk, { stream: true })
    }
  })().catch(() => undefined)
  await expect.poll(() => received).toContain('event: ready')

  const project = (await value<{ id: string }[]>('listProjects'))[0]!
  const { scripts } = await value<{ scripts: { id: string; name: string }[] }>(
    'listScripts',
    project.id
  )
  const tick = scripts.find((script) => script.name === 'tick')!
  const run = await value<{ id: string }>('startScript', project.id, tick.id)

  // The desktop UI shares the core, so it shows the remotely started run.
  const tickRow = page.locator('main li', { hasText: 'npm run tick' })
  await expect(tickRow.getByText('运行中')).toBeVisible()
  await expect.poll(() => received).toContain('"type":"run-output"')
  await expect.poll(() => received).toContain('tick 2')

  // What the remote side may not do.
  for (const [method, args] of [
    ['addProject', [dir]],
    ['updateSettings', [{ stopGraceSeconds: 1 }]],
    ['startShell', [project.id]],
    ['writeRunInput', [run.id, 'x']]
  ] as const) {
    const response = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ args })
    })
    expect(response.status, method).toBe(403)
  }

  await value('stopRun', run.id)
  await expect(tickRow.getByText('已停止')).toBeVisible()
  await expect.poll(() => received).toContain('"status":"exited"')

  await app.close()
  await reading
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

  // The Android app accepts the whole connect link, the same as the QR code.
  await section.getByRole('button', { name: '复制连接地址' }).click()
  await expect(section.getByRole('button', { name: '已复制' })).toBeVisible()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(
    `http://127.0.0.1:${port}/#token=${token}`
  )

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
