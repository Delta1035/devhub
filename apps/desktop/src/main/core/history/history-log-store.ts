import { createHash } from 'crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'
import {
  DevhubError,
  runHistoryOutputSchema,
  runHistoryOutputLimit,
  type RunHistoryOutput
} from '@devhub/shared'

export interface HistoryLogStore {
  read(runId: string): Promise<RunHistoryOutput | null>
  write(runId: string, output: RunHistoryOutput): Promise<void>
  remove(runId: string): Promise<void>
  /** Deletes only managed log files not referenced by the current metadata. */
  prune(runIds: string[]): Promise<void>
}

const idSchema = z.string().min(1).max(1024)
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'

export function createHistoryLogStore(directory: string): HistoryLogStore {
  const filename = (runId: string): string => {
    const parsed = idSchema.safeParse(runId)
    if (!parsed.success) throw new DevhubError('INVALID_INPUT', '运行 id 无效')
    // IDs from old files or transports never become path components.
    return `${createHash('sha256').update(parsed.data).digest('hex')}.json`
  }
  const removeFile = async (name: string): Promise<void> => {
    await unlink(join(directory, name)).catch((error: unknown) => {
      if (!missing(error)) throw error
    })
  }
  return {
    async read(runId) {
      let raw: string
      try {
        raw = await readFile(join(directory, filename(runId)), 'utf8')
      } catch (error) {
        if (missing(error)) return null
        throw error
      }
      try {
        const parsed = runHistoryOutputSchema.safeParse(JSON.parse(raw))
        return parsed.success &&
          Buffer.byteLength(parsed.data.data, 'utf8') <= runHistoryOutputLimit
          ? parsed.data
          : null
      } catch {
        return null
      }
    },
    async write(runId, output) {
      const parsed = runHistoryOutputSchema.safeParse(output)
      if (!parsed.success || Buffer.byteLength(parsed.data.data, 'utf8') > runHistoryOutputLimit) {
        throw new DevhubError('INVALID_INPUT', '历史日志超出容量限制或格式无效')
      }
      const path = join(directory, filename(runId))
      await mkdir(directory, { recursive: true })
      await writeFile(`${path}.tmp`, JSON.stringify(parsed.data), 'utf8')
      await rename(`${path}.tmp`, path)
    },
    async remove(runId) {
      const name = filename(runId)
      await removeFile(name)
      await removeFile(`${name}.tmp`)
    },
    async prune(runIds) {
      const keep = new Set(runIds.map(filename))
      let names: string[]
      try {
        names = await readdir(directory)
      } catch (error) {
        if (missing(error)) return
        throw error
      }
      for (const name of names) {
        if (/^[a-f0-9]{64}\.json(?:\.tmp)?$/.test(name) && !keep.has(name)) await removeFile(name)
      }
    }
  }
}
