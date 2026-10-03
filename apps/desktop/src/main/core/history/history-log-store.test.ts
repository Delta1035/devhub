import { createHash } from 'crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runHistoryOutputLimit } from '@devhub/shared'
import { createHistoryLogStore } from './history-log-store'

describe('history log files', () => {
  let directory: string
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'devhub-history-'))
  })
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })
  const name = (runId: string): string => `${createHash('sha256').update(runId).digest('hex')}.json`

  it('persists ordered Unicode and ANSI output across store instances', async () => {
    const first = createHistoryLogStore(directory)
    const output = { data: '\u001b[32m中文🙂\u001b[0m\nsecond line', truncated: true }
    await first.write('run', output)
    await expect(createHistoryLogStore(directory).read('run')).resolves.toEqual(output)
    expect(await readdir(directory)).toEqual([name('run')])
  })
  it('hashes external ids rather than allowing paths to escape the log directory', async () => {
    const store = createHistoryLogStore(directory)
    await store.write('../../projects.json', { data: 'safe', truncated: false })
    expect(await readdir(directory)).toEqual([name('../../projects.json')])
    await expect(store.read('')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('removes only unreferenced managed files and leftover temp snapshots', async () => {
    const store = createHistoryLogStore(directory)
    await store.write('kept', { data: 'kept', truncated: false })
    await store.write('old', { data: 'old', truncated: false })
    await writeFile(join(directory, `${name('kept')}.tmp`), 'unfinished write')
    await writeFile(join(directory, 'notes.txt'), 'unrelated')
    await store.prune(['kept'])
    expect((await readdir(directory)).sort()).toEqual([name('kept'), 'notes.txt'].sort())
    await store.remove('kept')
    await store.remove('kept')
    await expect(store.read('kept')).resolves.toBeNull()
    expect(await readFile(join(directory, 'notes.txt'), 'utf8')).toBe('unrelated')
  })
  it('rejects oversized UTF-8 writes and reports missing/corrupt snapshots as unavailable', async () => {
    const store = createHistoryLogStore(directory)
    await expect(
      store.write('large', { data: '中'.repeat(runHistoryOutputLimit / 2), truncated: true })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(store.read('missing')).resolves.toBeNull()
    await writeFile(join(directory, name('broken')), '{bad json')
    await expect(store.read('broken')).resolves.toBeNull()
    await writeFile(
      join(directory, name('broken')),
      JSON.stringify({ data: 'x', truncated: 'wrong' })
    )
    await expect(store.read('broken')).resolves.toBeNull()
  })
})
