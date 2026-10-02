import { stat } from 'fs/promises'
import type { ProjectScripts } from '@devhub/shared'
import { detectScripts } from '../detectors/detect-scripts'
import type { ScriptDetector } from '../detectors/types'
import type { ProjectService } from '../projects/project-service'

export interface ScriptService {
  /** Scans on every call so the result always matches the files on disk. */
  list(projectId: unknown): Promise<ProjectScripts>
}

export interface ScriptServiceDeps {
  projects: Pick<ProjectService, 'get'>
  detectors: readonly ScriptDetector[]
}

export function createScriptService({ projects, detectors }: ScriptServiceDeps): ScriptService {
  return {
    async list(projectId) {
      const project = await projects.get(projectId)
      if (!(await isDirectory(project.path))) {
        return { status: 'missing', scripts: [], warnings: [] }
      }
      return { status: 'ok', ...(await detectScripts(project.path, detectors)) }
    }
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return false
    throw error
  }
}
