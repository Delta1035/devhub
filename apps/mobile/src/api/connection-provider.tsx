import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RemoteError, type RemoteClient } from '@devhub/shared'
import type { ConnectionSettings } from './connect-input'
import { ConnectionContext, type Connection, type ConnectionState } from './connection-state'
import { createMobileClient } from './remote'
import { clearConnection, loadConnection, saveConnection } from './saved-connection'

const rejectedMessage = 'Token 无效或已在桌面端重新生成，请重新填写'

/** Connects to the saved desktop on launch and drops back to the connect page when refused. */
export function ConnectionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [state, setState] = useState<ConnectionState>({ status: 'loading' })
  // Responses to an old client (after a reconnect) must not log the new one out.
  const current = useRef<RemoteClient | null>(null)

  const open = useCallback(async (settings: ConnectionSettings): Promise<void> => {
    const client = createMobileClient(settings, () => {
      if (current.current !== client) return
      current.current = null
      void clearConnection()
      setState({
        status: 'disconnected',
        last: { ...settings, token: '' },
        message: rejectedMessage
      })
    })
    try {
      await client.session()
    } catch (error) {
      if (error instanceof RemoteError && error.code === 'UNAUTHORIZED') {
        throw new Error(rejectedMessage, { cause: error })
      }
      throw error
    }
    current.current = client
    setState({ status: 'connected', settings, client })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const saved = await loadConnection()
      if (cancelled) return
      if (!saved) {
        setState({ status: 'disconnected', last: null, message: null })
        return
      }
      try {
        await open(saved)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ status: 'disconnected', last: saved, message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Events missed while the stream was down are not replayed: refetch everything on reconnect.
  const client = state.status === 'connected' ? state.client : null
  useEffect(
    () => client?.events.onReady(() => void queryClient.invalidateQueries()),
    [client, queryClient]
  )

  const connection = useMemo<Connection>(
    () => ({
      state,
      async connect(settings) {
        queryClient.clear()
        await open(settings)
        await saveConnection(settings)
      },
      async disconnect() {
        const last = state.status === 'connected' ? state.settings : null
        current.current = null
        await clearConnection()
        queryClient.clear()
        setState({ status: 'disconnected', last: last && { ...last, token: '' }, message: null })
      }
    }),
    [state, open, queryClient]
  )

  return <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>
}
