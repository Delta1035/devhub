import { isIP } from 'net'
import { z } from 'zod'
import { defaultRemotePort } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

/**
 * `remote.json`. Kept apart from settings.json because settings are pushed to every client,
 * remote ones included, and the token must never be (ADR 0022).
 */
export const remoteFileSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  /** An IP address of this machine, or `0.0.0.0` / `::` for every interface. */
  host: z.string().refine((value) => isIP(value) !== 0),
  port: z.number().int().min(1).max(65535),
  allowTerminal: z.boolean(),
  /** Created on first use. */
  token: z.string().min(32).nullable()
})
export type RemoteFile = z.infer<typeof remoteFileSchema>
export type RemoteConfig = Omit<RemoteFile, 'version' | 'token'> & { token: string }

export const emptyRemoteFile = (): RemoteFile => ({
  version: 1,
  enabled: false,
  host: '127.0.0.1',
  port: defaultRemotePort,
  allowTerminal: false,
  token: null
})

export interface RemoteConfigStore {
  /** The configuration, generating and saving a token the first time. */
  get(): Promise<RemoteConfig>
}

export function createRemoteConfigStore({
  store,
  generateToken
}: {
  store: JsonStore<RemoteFile>
  generateToken: () => string
}): RemoteConfigStore {
  return {
    async get() {
      const file = await store.read()
      let token = file.token
      if (token === null) {
        token = generateToken()
        await store.write({ ...file, token })
      }
      const { enabled, host, port, allowTerminal } = file
      return { enabled, host, port, allowTerminal, token }
    }
  }
}
