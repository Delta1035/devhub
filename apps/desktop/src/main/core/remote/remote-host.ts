import {
  DevhubError,
  remoteConfigPatchSchema,
  type DevhubApi,
  type DevhubEvents,
  type NetworkAddress,
  type RemoteState,
  type RemoteStatus
} from '@devhub/shared'
import type { RemoteConfig, RemoteConfigStore } from './remote-config'
import { startRemoteServer, type RemoteServer } from './remote-server'

export interface RemoteHost {
  /** Starts the server when remote access is enabled; failures become the status, never throw. */
  start(): Promise<void>
  state(): Promise<RemoteState>
  /** Validates and saves a change, then restarts the server. */
  update(patch: unknown): Promise<RemoteState>
  /** New token; restarting drops every connection made with the old one. */
  regenerateToken(): Promise<RemoteState>
  /** Stops the server for good; safe to call when it never started. */
  dispose(): Promise<void>
}

/** Listen addresses offered besides the machine's own: this machine only, or every interface. */
const loopback = '127.0.0.1'
const everyInterface = '0.0.0.0'

/** Owns the remote server's lifecycle inside the core, driven by `remote.json` (ADR 0022). */
export function createRemoteHost({
  api,
  subscribe,
  config,
  addresses,
  webRoot,
  appVersion,
  log = console
}: {
  api: DevhubApi
  subscribe: DevhubEvents['subscribe']
  config: RemoteConfigStore
  /** Current addresses of this machine. */
  addresses: () => NetworkAddress[]
  /** The built web app to serve at `/`. */
  webRoot?: string
  /** The desktop's version, told to remote clients. */
  appVersion: string
  log?: Pick<Console, 'info' | 'error'>
}): RemoteHost {
  let server: RemoteServer | null = null
  let status: RemoteStatus = { state: 'off' }
  let disposed = false
  let queue: Promise<unknown> = Promise.resolve()
  // Restarts must not overlap: two servers would race for the same port.
  const serial = <T>(step: () => Promise<T>): Promise<T> => {
    const next = queue.then(step)
    queue = next.catch(() => undefined)
    return next
  }

  const restart = async (current: RemoteConfig): Promise<void> => {
    await server?.close()
    server = null
    status = { state: 'off' }
    if (!current.enabled || disposed) return
    const { host, port, token, allowTerminal } = current
    try {
      server = await startRemoteServer({
        api,
        subscribe,
        host,
        port,
        token,
        allowTerminal,
        appVersion,
        webRoot
      })
      status = { state: 'listening', port: server.port }
      log.info(`[remote] listening on ${host}:${server.port}`)
    } catch (error) {
      status = { state: 'error', message: listenFailure(error, host, port) }
      log.error('[remote] failed to start', error)
    }
  }

  const view = (current: RemoteConfig): RemoteState => ({
    ...current,
    status,
    addresses: addresses()
  })

  return {
    start: () =>
      serial(async () => {
        try {
          // Disabled: nothing to do, and no token is generated (nor remote.json written).
          if (await config.isEnabled()) await restart(await config.get())
        } catch (error) {
          status = { state: 'error', message: '无法读取远程访问设置' }
          log.error('[remote] failed to start', error)
        }
      }),

    state: () => serial(async () => view(await config.get())),

    update: (rawPatch) =>
      serial(async () => {
        const parsed = remoteConfigPatchSchema.safeParse(rawPatch)
        if (!parsed.success) throw new DevhubError('INVALID_INPUT', '远程访问设置无效')
        const patch = parsed.data
        const current = await config.get()
        if (patch.host !== undefined && patch.host !== current.host) {
          const allowed = [loopback, everyInterface, ...addresses().map((entry) => entry.address)]
          if (!allowed.includes(patch.host)) {
            throw new DevhubError('INVALID_INPUT', `${patch.host} 不是这台电脑的地址`)
          }
        }
        const next = await config.update(patch)
        await restart(next)
        return view(next)
      }),

    regenerateToken: () =>
      serial(async () => {
        const next = await config.regenerateToken()
        await restart(next)
        return view(next)
      }),

    dispose: () =>
      serial(async () => {
        disposed = true
        await server?.close()
        server = null
        status = { state: 'off' }
      })
  }
}

function listenFailure(error: unknown, host: string, port: number): string {
  switch ((error as NodeJS.ErrnoException).code) {
    case 'EADDRINUSE':
      return `端口 ${port} 已被占用`
    case 'EADDRNOTAVAIL':
      return `地址 ${host} 当前不可用，网络或 Tailscale 可能未连接`
    case 'EACCES':
      return `没有权限监听端口 ${port}`
    default:
      return `无法启动远程访问：${error instanceof Error ? error.message : String(error)}`
  }
}
