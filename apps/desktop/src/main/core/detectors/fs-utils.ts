import { access, readFile } from 'fs/promises'
import { basename, join } from 'path'

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

export interface WrapperSpec {
  /** Windows wrapper file, invoked by name (cmd.exe looks in the cwd first). */
  win32: string
  /** POSIX wrapper file, invoked as `./<file>`. */
  posix: string
  /** Executable on PATH used when the project has no wrapper. */
  fallback: string
}

/** Prefers the project's build-tool wrapper for the current platform. */
export async function resolveWrapper(
  dir: string,
  platform: NodeJS.Platform,
  spec: WrapperSpec
): Promise<string> {
  const [file, invocation] =
    platform === 'win32' ? [spec.win32, spec.win32] : [spec.posix, `./${spec.posix}`]
  return (await exists(join(dir, file))) ? invocation : spec.fallback
}
