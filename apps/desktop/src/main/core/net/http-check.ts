/** True when a GET to `url` answers 2xx within the timeout; any network error counts as false. */
export async function checkHttpOk(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      // A redirect to a login page is not a healthy endpoint.
      redirect: 'manual'
    })
    // The body is not needed; release the connection.
    await response.body?.cancel()
    return response.ok
  } catch {
    return false
  }
}

/**
 * Checks a local HTTP endpoint on IPv4 and IPv6 loopback: dev servers bound to "localhost"
 * may listen on either.
 */
export async function checkLocalHttp(
  port: number,
  path: string,
  timeoutMs = 2000
): Promise<boolean> {
  const results = await Promise.all([
    checkHttpOk(`http://127.0.0.1:${port}${path}`, timeoutMs),
    checkHttpOk(`http://[::1]:${port}${path}`, timeoutMs)
  ])
  return results.some(Boolean)
}
