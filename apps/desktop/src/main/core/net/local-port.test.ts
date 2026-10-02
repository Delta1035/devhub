import { createServer, type Server } from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import { checkLocalPort } from './local-port'

describe('checkLocalPort', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
    server = undefined
  })

  it('detects a listening port and a closed one', async () => {
    server = createServer()
    const port = await new Promise<number>((resolve) =>
      server!.listen(0, '127.0.0.1', () => {
        const address = server!.address()
        resolve(typeof address === 'object' && address ? address.port : 0)
      })
    )
    await expect(checkLocalPort(port)).resolves.toBe(true)
    server.close()
    server = undefined
    await expect(checkLocalPort(port)).resolves.toBe(false)
  })
})
