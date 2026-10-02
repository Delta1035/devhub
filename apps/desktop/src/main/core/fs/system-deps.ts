import { execFile } from 'child_process'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { promisify } from 'util'
import { exists } from '../detectors/fs-utils'
import type { FinderDeps } from './finder'

const execFileAsync = promisify(execFile)

export interface SystemDeps extends FinderDeps {
  queryRegistry: (key: string) => Promise<string>
}

/** Writes a file, creating its directory first. */
export async function writeFileEnsuringDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

/** The real file system, PATH and (on Windows) registry, for locating installed programs. */
export function systemDeps(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): SystemDeps {
  return {
    platform,
    env,
    exists,
    listDir: (path) => readdir(path).catch(() => []),
    // `reg` exits non-zero when the key is missing; treat that as "nothing installed".
    queryRegistry: (key) =>
      execFileAsync('reg', ['query', key, '/s'], { windowsHide: true })
        .then((result) => result.stdout)
        .catch(() => '')
  }
}
