import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RemoteError, protocolMismatch } from '@devhub/shared'
import { access, appUpdates, remote, scanQrCode } from '@renderer/api'
import type { RemoteConnection, SavedConnection } from '@renderer/api/remote-connection'
import { AppUpdateBanner } from './app-update-banner'
import { ConnectPage } from './connect-page'

const rejectedMessage = (choosesAddress: boolean): string =>
  `访问令牌无效或已重新生成，请重新${choosesAddress ? '粘贴连接地址' : '扫码连接'}`

/**
 * In the web app and the Android app, renders the app only once the desktop accepted the token,
 * and returns to the connect page when it stops accepting it. Inside Electron it renders the app
 * directly.
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
  // Undefined until the saved connection is read (the app's storage is asynchronous).
  const [saved, setSaved] = useState<SavedConnection>()
  const [rejected, setRejected] = useState(false)
  // The app user asked to enter another desktop instead of retrying this one.
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    void connection.restore().then(setSaved)
  }, [connection])

  // This web bundle rendered: a live update that got this far is not rolled back.
  useEffect(() => appUpdates?.confirm(), [])

  const token = saved?.token ?? null
  const session = useQuery({
    queryKey: ['remote-session', saved?.baseUrl, token],
    enabled: token !== null,
    retry: false,
    queryFn: async () => {
      try {
        const value = await connection.client.session()
        access.terminal = value.allowTerminal
        appUpdates?.sync(value.appVersion)
        return { accepted: true as const, behind: protocolMismatch(value.protocol) }
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

  const submit = (next: SavedConnection): void => {
    connection.connect(next)
    setRejected(false)
    setChanging(false)
    setSaved(next)
  }

  if (saved === undefined) return <></>
  if (token !== null && !rejected && !changing && session.data?.accepted) {
    return (
      <>
        <AppUpdateBanner behind={session.data.behind} />
        {children}
      </>
    )
  }

  const refused = rejected || session.data?.accepted === false
  return (
    <ConnectPage
      choosesAddress={connection.choosesAddress}
      address={saved.baseUrl}
      checking={token !== null && !refused && !changing && session.isFetching}
      message={
        changing
          ? null
          : refused
            ? rejectedMessage(connection.choosesAddress)
            : session.error
              ? session.error.message
              : null
      }
      offline={!refused && !changing && session.isError}
      onRetry={() => void session.refetch()}
      onChange={() => setChanging(true)}
      onScan={scanQrCode ?? undefined}
      onSubmit={submit}
    />
  )
}
