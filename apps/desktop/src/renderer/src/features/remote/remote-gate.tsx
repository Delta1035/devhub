import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RemoteError } from '@devhub/shared'
import { access, remote } from '@renderer/api'
import type { RemoteConnection } from '@renderer/api/remote-connection'
import { ConnectPage } from './connect-page'

const rejectedMessage = '访问令牌无效或已重新生成，请重新扫码连接'

/**
 * In the web app, renders the app only once the desktop accepted the token, and returns to the
 * connect page when it stops accepting it. Inside Electron it renders the app directly.
 */
export function RemoteGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  return remote ? <Gate connection={remote}>{children}</Gate> : <>{children}</>
}

function Gate({
  connection,
  children
}: {
  connection: RemoteConnection
  children: React.ReactNode
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(connection.token())
  const [rejected, setRejected] = useState(false)

  const session = useQuery({
    queryKey: ['remote-session', token],
    enabled: token !== null,
    retry: false,
    queryFn: async () => {
      try {
        const value = await connection.client.session()
        access.terminal = value.allowTerminal
        return { accepted: true as const }
      } catch (error) {
        if (error instanceof RemoteError && error.code === 'UNAUTHORIZED') {
          connection.clearToken()
          return { accepted: false as const }
        }
        throw error
      }
    }
  })

  // The desktop may stop accepting the token later (regenerated): back to the connect page.
  useEffect(
    () =>
      connection.onUnauthorized(() => {
        connection.clearToken()
        setRejected(true)
      }),
    [connection]
  )

  // Events missed while the stream was down are not replayed: refetch everything on reconnect.
  useEffect(
    () => connection.client.events.onReady(() => void queryClient.invalidateQueries()),
    [connection, queryClient]
  )

  const submit = (value: string): void => {
    connection.setToken(value)
    setRejected(false)
    setToken(value)
  }

  if (token !== null && !rejected && session.data?.accepted) return <>{children}</>

  const refused = rejected || session.data?.accepted === false
  return (
    <ConnectPage
      checking={token !== null && !refused && session.isFetching}
      message={refused ? rejectedMessage : session.error ? session.error.message : null}
      offline={!refused && session.isError}
      onRetry={() => void session.refetch()}
      onSubmit={submit}
    />
  )
}
