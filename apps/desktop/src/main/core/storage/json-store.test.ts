import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createJsonStore } from './json-store'

const schema = z.object({ count: z.number() })

describe('createJsonStore', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-store-'))
    filePath = join(dir, 'nested', 'data.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const makeStore = (warn = vi.fn()) =>
    createJsonStore({ filePath, schema, fallback: () => ({ count: 0 }), warn })

  it('returns the fallback when the file does not exist', async () => {
    await expect(makeStore().read()).resolves.toEqual({ count: 0 })
  })

  it('round-trips written data and creates missing directories', async () => {
    const store = makeStore()
    await store.write({ count: 3 })
    await expect(store.read()).resolves.toEqual({ count: 3 })
    expect(JSON.parse(await readFile(filePath, 'utf8'))).toEqual({ count: 3 })
  })

  it.each([
    ['malformed JSON', '{ not json'],
    ['schema mismatch', '{"count":"three"}']
  ])('backs up the file and returns the fallback on %s', async (_label, content) => {
    const store = makeStore()
    await store.write({ count: 1 })
    await writeFile(filePath, content, 'utf8')
    const warn = vi.fn()

    await expect(makeStore(warn).read()).resolves.toEqual({ count: 0 })

    const files = await readdir(join(dir, 'nested'))
    expect(files.some((name) => name.startsWith('data.json.corrupt-'))).toBe(true)
    expect(files).not.toContain('data.json')
    expect(warn).toHaveBeenCalledOnce()
  })
})
