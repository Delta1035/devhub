import { constants } from 'fs'
import { access, readFile } from 'fs/promises'
import { basename, join } from 'path'

/** Reads a build file; null when it does not exist, a user-facing error for anything else. */
export async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new Error(`无法读取 ${basename(path)}：${(error as Error).message}`, { cause: error })
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

/** True when the current user may execute the file (POSIX permission bits). */
export async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Prefers the project's build-tool wrapper for the current platform. A POSIX wrapper that lost
 * its executable bit (unzipped archive, checkout made on Windows) is run through `sh`, since
 * mvnw and gradlew are shell scripts; `./mvnw` would fail with "Permission denied".
 */
export async function resolveWrapper(
  dir: string,
  platform: NodeJS.Platform,
  spec: WrapperSpec,
  canExecute: (path: string) => Promise<boolean> = isExecutable
): Promise<string> {
  if (platform === 'win32') {
    return (await exists(join(dir, spec.win32))) ? spec.win32 : spec.fallback
  }
  const wrapper = join(dir, spec.posix)
  if (!(await exists(wrapper))) return spec.fallback
  return (await canExecute(wrapper)) ? `./${spec.posix}` : `sh ./${spec.posix}`
}
