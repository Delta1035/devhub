import { createContext, useContext } from 'react'
import type { DevhubApi, RemoteClient, RemoteEvents } from '@devhub/shared'
import type { ConnectionSettings } from './connect-input'

export type ConnectionState =
  | { status: 'loading' }
  /** `last` pre-fills the connect form; `message` says why the app is not connected. */
  | { status: 'disconnected'; last: ConnectionSettings | null; message: string | null }
  | { status: 'connected'; settings: ConnectionSettings; client: RemoteClient }

export interface Connection {
  state: ConnectionState
  /** Checks the token with the desktop, then saves it. Throws a message for the connect form. */
  connect(settings: ConnectionSettings): Promise<void>
  /** Forgets the token; the address stays in the form. */
  disconnect(): Promise<void>
}

export const ConnectionContext = createContext<Connection | null>(null)

export function useConnection(): Connection {
  const connection = useContext(ConnectionContext)
  if (!connection) throw new Error('useConnection must be used inside ConnectionProvider')
  return connection
}

/** The desktop's API for screens behind the connect page. */
export function useDevhub(): { api: DevhubApi; events: RemoteEvents } {
  const { state } = useConnection()
  if (state.status !== 'connected') throw new Error('useDevhub needs a connection')
  return { api: state.client.api, events: state.client.events }
}
