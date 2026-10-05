import { mkdtemp, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDevhubCore } from './devhub-core'

describe('createDevhubCore', () => {
  let dataDir: string

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'devhub-core-'))
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
  })

  it('reports app info from the injected environment', async () => {
    const core = createDevhubCore({ version: '1.2.3', platform: 'linux', dataDir })
    await expect(core.getAppInfo()).resolves.toEqual({ version: '1.2.3', platform: 'linux' })
  })

  it('does not write any data file just by starting', async () => {
    const core = createDevhubCore({ version: '1.2.3', platform: process.platform, dataDir })
    await core.listOrphanedRuns()
    // Waits for background start-up work, such as checking whether remote access is on.
    await core.dispose()
    await expect(readdir(dataDir)).resolves.toEqual([])
  })
})
