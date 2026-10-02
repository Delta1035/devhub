import { connect } from 'net'

/** Tries IPv4 and IPv6 loopback: dev servers bound to "localhost" may listen on either. */
export async function checkLocalPort(port: number): Promise<boolean> {
  const tryHost = (host: string): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = connect({ port, host })
      const done = (open: boolean): void => {
        socket.destroy()
        resolve(open)
      }
      socket.setTimeout(1000, () => done(false))
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
    })
  const results = await Promise.all([tryHost('127.0.0.1'), tryHost('::1')])
  return results.some(Boolean)
}
