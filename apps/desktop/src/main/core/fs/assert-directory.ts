import { stat } from 'fs/promises'
import { DevhubError } from '@devhub/shared'

/** Throws a user-facing error unless `path` is an existing directory. */
export async function assertDirectory(path: string): Promise<void> {
  try {
    const stats = await stat(path)
    if (!stats.isDirectory()) {
      throw new DevhubError('PROJECT_PATH_NOT_DIRECTORY', `不是一个目录：${path}`)
    }
  } catch (error) {
    if (error instanceof DevhubError) throw error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${path}`)
    }
    throw error
  }
}
