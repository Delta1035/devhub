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

  it('keeps an existing token', async () => {
    await open().get()
    const config = await open(() => 'x'.repeat(43)).get()
    expect(config.token).toBe(token)
  })

  it.each([{ host: 'example.com' }, { port: 0 }, { token: 'short' }])(
    'starts from the defaults when the file has %o',
    async (patch) => {
      await writeFile(filePath, JSON.stringify({ ...emptyRemoteFile(), enabled: true, ...patch }))
      expect((await open().get()).enabled).toBe(false)
    }
  )
})
