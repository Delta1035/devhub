import { z } from 'zod'
import { DevhubError, type Project, type ProjectScripts, type Script } from '@devhub/shared'
import { detectScripts } from '../detectors/detect-scripts'
import { isDirectory } from '../fs/is-directory'
import type { ScriptDetector } from '../detectors/types'
import type { ProjectService } from '../projects/project-service'

export interface ScriptService {
  /** Scans on every call so the result always matches the files on disk. */
  list(projectId: unknown): Promise<ProjectScripts>
  /** Resolves a script by id from a fresh scan, so a run always uses the current command. */
  find(projectId: unknown, scriptId: unknown): Promise<{ project: Project; script: Script }>
}

export interface ScriptServiceDeps {
  projects: Pick<ProjectService, 'get'>
  detectors: readonly ScriptDetector[]
}

const idInput = z.string().min(1)

export function createScriptService({ projects, detectors }: ScriptServiceDeps): ScriptService {
  const scan = async (project: Project): Promise<ProjectScripts> => {
    if (!(await isDirectory(project.path))) {
      return { status: 'missing', scripts: [], warnings: [] }
    }
    return { status: 'ok', ...(await detectScripts(project.path, detectors)) }
  }

  return {
    async list(projectId) {
      return scan(await projects.get(projectId))
    },

    async find(projectId, scriptId) {
      const project = await projects.get(projectId)
      const result = await scan(project)
      if (result.status === 'missing') {
        throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${project.path}`)
      }
      const parsed = idInput.safeParse(scriptId)
      const script = parsed.success
        ? result.scripts.find((candidate) => candidate.id === parsed.data)
        : undefined
      if (!script) throw new DevhubError('SCRIPT_NOT_FOUND', '脚本不存在，可能已从项目中删除')
      return { project, script }
    }
  }
}
