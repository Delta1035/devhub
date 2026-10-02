import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { z } from 'zod'

export interface JsonStore<T> {
  read(): Promise<T>
  write(value: T): Promise<void>
}

export interface JsonStoreOptions<T> {
  filePath: string
  schema: z.ZodType<T>
  fallback: () => T
  warn?: (message: string) => void
}

/**
 * A single JSON file validated by a zod schema.
 * - Missing file: returns the fallback.
 * - Unreadable or invalid file: moved aside as `<file>.corrupt-<timestamp>`, returns the fallback.
 * - Writes go to a temp file first and are renamed into place, so a crash never leaves half a file.
 */
export function createJsonStore<T>({
  filePath,
  schema,
  fallback,
  warn = console.warn
}: JsonStoreOptions<T>): JsonStore<T> {
  return {
    async read() {
      let raw: string
      try {
        raw = await readFile(filePath, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback()
        throw error
      }

      const parsed = safeJsonParse(raw)
      const result = parsed.ok ? schema.safeParse(parsed.value) : null
      if (result?.success) return result.data

      const backupPath = `${filePath}.corrupt-${Date.now()}`
      await rename(filePath, backupPath)
      warn(`Invalid data in ${filePath}; moved to ${backupPath} and starting fresh.`)
      return fallback()
    },

    async write(value) {
      await mkdir(dirname(filePath), { recursive: true })
      const tempPath = `${filePath}.tmp`
      await writeFile(tempPath, JSON.stringify(value, null, 2) + '\n', 'utf8')
      await rename(tempPath, filePath)
    }
  }
}

function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}
