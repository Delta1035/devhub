import type { DevhubApi, DevhubEvents } from '@devhub/shared'
import type { RemoteConfigStore } from './remote-config'
import { startRemoteServer, type RemoteServer } from './remote-server'

export interface RemoteHost {
  /** Starts the server when remote access is enabled; failures are logged, never thrown. */
  start(): Promise<void>
  /** Stops the server; safe to call when it never started. */
  dispose(): Promise<void>
}

/** Owns the remote server's lifecycle inside the core, driven by `remote.json`. */
export function createRemoteHost({
  api,
  subscribe,
  config,
  log = console
}: {
  api: DevhubApi
  subscribe: DevhubEvents['subscribe']
  config: RemoteConfigStore
  log?: Pick<Console, 'info' | 'error'>
}): RemoteHost {
  let server: RemoteServer | null = null
  let starting: Promise<void> | null = null

  const start = async (): Promise<void> => {
    try {
      const { enabled, host, port, token, allowTerminal } = await config.get()
      if (!enabled) return
      server = await startRemoteServer({ api, subscribe, host, port, token, allowTerminal })
      log.info(`[remote] listening on ${host}:${server.port}`)
    } catch (error) {
      log.error('[remote] failed to start', error)
    }
  }

  return {
    start() {
      starting ??= start()
      return starting
    },
    async dispose() {
      await starting
      await server?.close()
      server = null
    }
  }
}
