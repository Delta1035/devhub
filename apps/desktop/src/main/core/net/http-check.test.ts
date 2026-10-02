import { createServer, type Server } from 'http'
import { afterEach, describe, expect, it } from 'vitest'
import { checkHttpOk, checkLocalHttp } from './http-check'

describe('HTTP checks', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
    server = undefined
  })

  /** Answers each path with its status: /ok → 200, /missing → 404, /login → 302. */
  const listen = (): Promise<number> => {
    server = createServer((request, response) => {
      const status = { '/ok': 200, '/login': 302 }[request.url ?? ''] ?? 404
      response.writeHead(status, status === 302 ? { location: '/ok' } : {}).end('body')
    })
    return new Promise((resolve) =>
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    )
  }

  it('is true only for a 2xx answer, without following redirects', async () => {
    const port = await listen()
    await expect(checkHttpOk(`http://127.0.0.1:${port}/ok`)).resolves.toBe(true)
    await expect(checkHttpOk(`http://127.0.0.1:${port}/missing`)).resolves.toBe(false)
    await expect(checkHttpOk(`http://127.0.0.1:${port}/login`)).resolves.toBe(false)
  })

  it('finds a server on either loopback address, and is false when nothing listens', async () => {
    const port = await listen()
    await expect(checkLocalHttp(port, '/ok')).resolves.toBe(true)
    server!.close()
    server = undefined
    await expect(checkLocalHttp(port, '/ok')).resolves.toBe(false)
  })

  it('gives up after the timeout', async () => {
    // Accepts the connection but never answers.
    server = createServer(() => undefined)
    const port = await new Promise<number>((resolve) =>
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    )
    await expect(checkHttpOk(`http://127.0.0.1:${port}/`, 200)).resolves.toBe(false)
    server.closeAllConnections()
  })
})
