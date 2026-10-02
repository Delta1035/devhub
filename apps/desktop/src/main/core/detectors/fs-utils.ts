import { access, readFile } from 'fs/promises'
import { basename } from 'path'

/** Reads a build file; null when it does not exist, a user-facing error for anything else. */
export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error(`无法读取 ${basename(path)}：${(error as Error).message}`)
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
