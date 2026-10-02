import { stat } from 'fs/promises'

/** True for an existing regular file; false for missing paths, directories and errors. */
export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
