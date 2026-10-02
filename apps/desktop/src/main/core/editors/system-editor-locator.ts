import { execFile } from 'child_process'
import { readdir } from 'fs/promises'
import { promisify } from 'util'
import { exists } from '../detectors/fs-utils'
import { createEditorLocator, type EditorLocator } from './editor-locator'

const execFileAsync = promisify(execFile)

/** The locator wired to the real file system, PATH and (on Windows) registry. */
export function createSystemEditorLocator(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): EditorLocator {
  return createEditorLocator({
    platform,
    env,
    exists,
    listDir: (path) => readdir(path).catch(() => []),
    // `reg` exits non-zero when the key is missing; treat that as "nothing installed".
    queryRegistry: (key) =>
      execFileAsync('reg', ['query', key, '/s'], { windowsHide: true })
        .then((result) => result.stdout)
        .catch(() => '')
  })
}
