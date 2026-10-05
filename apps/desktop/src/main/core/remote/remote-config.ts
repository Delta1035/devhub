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
  /** Reads without writing, so starting DevHub with remote access off creates no file. */
  isEnabled(): Promise<boolean>
  /** The configuration, generating and saving a token the first time. */
  get(): Promise<RemoteConfig>
  /** Saves an already validated change. */
  update(change: Partial<Omit<RemoteConfig, 'token'>>): Promise<RemoteConfig>
  regenerateToken(): Promise<RemoteConfig>
}

export function createRemoteConfigStore({
  store,
  generateToken
}: {
  store: JsonStore<RemoteFile>
  generateToken: () => string
}): RemoteConfigStore {
  let queue: Promise<unknown> = Promise.resolve()
  // Read-modify-write steps run one at a time so concurrent changes are not lost.
  const serial = <T>(step: () => Promise<T>): Promise<T> => {
    const next = queue.then(step)
    queue = next.catch(() => undefined)
    return next
  }

  const change = (modify: (file: RemoteFile) => RemoteFile): Promise<RemoteConfig> =>
    serial(async () => {
      const current = await store.read()
      const file = modify(current)
      const token = file.token ?? generateToken()
      if (file !== current || current.token === null) await store.write({ ...file, token })
      const { enabled, host, port, allowTerminal } = file
      return { enabled, host, port, allowTerminal, token }
    })

  return {
    isEnabled: () => serial(async () => (await store.read()).enabled),
    get: () => change((file) => file),
    update: (patch) => change((file) => remoteFileSchema.parse({ ...file, ...patch })),
    regenerateToken: () => change((file) => ({ ...file, token: generateToken() }))
  }
}
