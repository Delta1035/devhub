import { createServer, type Server } from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import { createPortOwnerFinder, createPortOwnersFinder } from './port-owner'

describe('createPortOwnerFinder on this machine', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
  })

  it('finds this test process through the real OS tool, then confirms the port is released', async () => {
    const listener = createServer()
    server = listener
    const port = await new Promise<number>((resolve, reject) => {
      listener.once('error', reject)
      listener.listen(0, '127.0.0.1', () => {
        const address = listener.address()
        if (typeof address === 'object' && address) resolve(address.port)
        else reject(new Error('Expected a TCP address'))
      })
    })
    const findOwners = createPortOwnersFinder({ platform: process.platform })
    expect((await findOwners(port)).map(({ pid }) => pid)).toEqual([process.pid])
    expect(await createPortOwnerFinder({ platform: process.platform })(port)).toMatchObject({
      pid: process.pid
    })
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve()))
    )
    server = undefined
    await expect(findOwners(port)).resolves.toEqual([])
  }, 20_000)
})
