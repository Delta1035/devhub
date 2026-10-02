import { join } from 'path'
import type { DevhubApi } from '@devhub/shared'
import { createJsonStore } from './storage/json-store'
import {
  createProjectService,
  emptyProjectsFile,
  projectsFileSchema
} from './projects/project-service'
import { createDefaultDetectors } from './detectors/detect-scripts'
import { createScriptService } from './scripts/script-service'

export interface CoreEnvironment {
  version: string
  platform: NodeJS.Platform
  /** Directory for DevHub's own persistent data. */
  dataDir: string
}

/**
 * Transport-agnostic implementation of the DevHub API.
 * Must not import from 'electron': it is wrapped by the IPC layer today and an HTTP layer later.
 * Arguments arrive from untrusted transports, so services validate them at runtime.
 */
export function createDevhubCore(env: CoreEnvironment): DevhubApi {
  const projects = createProjectService({
    store: createJsonStore({
      filePath: join(env.dataDir, 'projects.json'),
      schema: projectsFileSchema,
      fallback: emptyProjectsFile
    }),
    platform: env.platform
  })

  const scripts = createScriptService({
    projects,
    detectors: createDefaultDetectors(env.platform)
  })

  return {
    async getAppInfo() {
      return { version: env.version, platform: env.platform }
    },
    listProjects: () => projects.list(),
    addProject: (path) => projects.add(path),
    removeProject: (projectId) => projects.remove(projectId),
    listScripts: (projectId) => scripts.list(projectId)
  }
}
