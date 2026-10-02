import type { DevhubApi } from '@devhub/shared'

export interface CoreEnvironment {
  version: string
  platform: NodeJS.Platform
}

/**
 * Transport-agnostic implementation of the DevHub API.
 * Must not import from 'electron': it is wrapped by the IPC layer today and an HTTP layer later.
 */
export function createDevhubCore(env: CoreEnvironment): DevhubApi {
  return {
    async getAppInfo() {
      return { version: env.version, platform: env.platform }
    }
  }
}
