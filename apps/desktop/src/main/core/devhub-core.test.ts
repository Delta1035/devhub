import { describe, expect, it } from 'vitest'
import { createDevhubCore } from './devhub-core'

describe('createDevhubCore', () => {
  it('reports app info from the injected environment', async () => {
    const core = createDevhubCore({ version: '1.2.3', platform: 'linux' })
    await expect(core.getAppInfo()).resolves.toEqual({ version: '1.2.3', platform: 'linux' })
  })
})
