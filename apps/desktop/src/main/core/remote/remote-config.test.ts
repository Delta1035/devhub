import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createJsonStore } from '../storage/json-store'
import { createRemoteConfigStore, emptyRemoteFile, remoteFileSchema } from './remote-config'

describe('remote config', () => {
  let dir: string
  let filePath: string
  const token = 't'.repeat(43)

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-remote-'))
    filePath = join(dir, 'remote.json')
  })
  afterEach(() => rm(dir, { recursive: true, force: true }))

  const open = (generate = () => token) =>
    createRemoteConfigStore({
      store: createJsonStore({
        filePath,
        schema: remoteFileSchema,
        fallback: emptyRemoteFile,
        warn: () => undefined
      }),
      generateToken: generate
    })

  it('is disabled on loopback by default and saves the token it generates', async () => {
    const config = await open().get()
    expect(config).toEqual({
      enabled: false,
      host: '127.0.0.1',
      port: 7420,
      allowTerminal: false,
      token
    })
    expect(JSON.parse(await readFile(filePath, 'utf8')).token).toBe(token)
  })

  it('checks whether it is enabled without creating the file', async () => {
    await expect(open().isEnabled()).resolves.toBe(false)
    await expect(readFile(filePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('keeps an existing token', async () => {
    await open().get()
    const config = await open(() => 'x'.repeat(43)).get()
    expect(config.token).toBe(token)
  })

  it('saves changes and keeps the token', async () => {
    const config = open()
    await config.get()
    await config.update({ enabled: true, port: 8000 })
    expect(await open().get()).toMatchObject({ enabled: true, port: 8000, token })
  })

  it('replaces the token on request', async () => {
    let counter = 0
    const config = open(() => `${++counter}`.padEnd(43, 'k'))
    const first = (await config.get()).token
    const second = (await config.regenerateToken()).token
    expect(second).not.toBe(first)
    expect((await open().get()).token).toBe(second)
  })

  it('applies concurrent changes one after another', async () => {
    const config = open()
    await Promise.all([config.update({ enabled: true }), config.update({ allowTerminal: true })])
    expect(await config.get()).toMatchObject({ enabled: true, allowTerminal: true })
  })

  it.each([{ host: 'example.com' }, { port: 0 }, { token: 'short' }])(
    'starts from the defaults when the file has %o',
    async (patch) => {
      await writeFile(filePath, JSON.stringify({ ...emptyRemoteFile(), enabled: true, ...patch }))
      expect((await open().get()).enabled).toBe(false)
    }
  )
})
