import { join } from 'path'
import type { DevhubApi, DevhubEvents } from '@devhub/shared'
import { createJsonStore } from './storage/json-store'
import {
  createProjectService,
  emptyProjectsFile,
  projectsFileSchema
} from './projects/project-service'
import { createDefaultDetectors } from './detectors/detect-scripts'
import { launchDetached } from './editors/editor-launch'
import { createEditorService } from './editors/editor-service'
import { createSystemEditorLocator } from './editors/system-editor-locator'
import { createEventBus } from './events/event-bus'
import { createProcessKiller } from './process/process-killer'
import { nodePtySpawner } from './process/pty'
import { createRunManager } from './process/run-manager'
import { createScriptService } from './scripts/script-service'

export interface CoreEnvironment {
  version: string
  platform: NodeJS.Platform
  /** Directory for DevHub's own persistent data. */
  dataDir: string
}

export interface DevhubCore extends DevhubApi, DevhubEvents {
  /** Stops all runs. Call before the host process exits so no orphans are left behind. */
  dispose(): Promise<void>
}

/**
 * Transport-agnostic implementation of the DevHub API.
 * Must not import from 'electron': it is wrapped by the IPC layer today and an HTTP layer later.
 * Arguments arrive from untrusted transports, so services validate them at runtime.
 */
export function createDevhubCore(env: CoreEnvironment): DevhubCore {
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

  const events = createEventBus((error) => console.error('[core] event listener failed', error))

  const editors = createEditorService({
    projects,
    locator: createSystemEditorLocator(env.platform, process.env),
    launch: launchDetached,
    env: process.env
  })

  const runs = createRunManager({
    scripts,
    spawn: nodePtySpawner,
    killer: createProcessKiller({ platform: env.platform }),
    platform: env.platform,
    emit: (event) => events.emit(event)
  })

  return {
    async getAppInfo() {
      return { version: env.version, platform: env.platform }
    },
    listProjects: () => projects.list(),
    addProject: (path) => projects.add(path),
    removeProject: (projectId) => projects.remove(projectId),
    listScripts: (projectId) => scripts.list(projectId),
    startScript: (projectId, scriptId) => runs.start(projectId, scriptId),
    stopRun: (runId) => runs.stop(runId),
    restartRun: (runId) => runs.restart(runId),
    listRuns: async () => runs.list(),
    getRunOutput: async (runId) => runs.output(runId),
    writeRunInput: async (runId, data) => runs.writeInput(runId, data),
    resizeRun: async (runId, cols, rows) => runs.resize(runId, cols, rows),
    removeRun: async (runId) => runs.remove(runId),
    listEditors: () => editors.list(),
    openInEditor: (projectId, editor) => editors.open(projectId, editor),
    subscribe: (listener) => events.subscribe(listener),
    dispose: () => runs.dispose()
  }
}
