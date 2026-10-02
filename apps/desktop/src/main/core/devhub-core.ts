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
import { createEditorLocator } from './editors/editor-locator'
import { isFile } from './fs/is-file'
import { systemDeps, writeFileEnsuringDir } from './fs/system-deps'
import { checkLocalPort } from './groups/conditions'
import { createGroupRunner } from './groups/group-runner'
import { createGroupService, emptyGroupsFile, groupsFileSchema } from './groups/group-service'
import { createEventBus } from './events/event-bus'
import { createIdentityReader } from './process/process-identity'
import { createProcessKiller } from './process/process-killer'
import { nodePtySpawner } from './process/pty'
import { createRunManager } from './process/run-manager'
import { createRunRegistry, emptyRunsFile, runsFileSchema } from './process/run-registry'
import { createScriptService } from './scripts/script-service'
import {
  createSettingsService,
  emptySettingsFile,
  settingsFileSchema
} from './settings/settings-service'
import { withPreferredShell } from './shells/prefer-shell'
import { createShellLocator } from './shells/shell-locator'

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

  const settings = createSettingsService({
    store: createJsonStore({
      filePath: join(env.dataDir, 'settings.json'),
      schema: settingsFileSchema,
      fallback: emptySettingsFile
    }),
    isFile,
    emit: (event) => events.emit(event)
  })
  // Read synchronously at every stop; kept current by the settings events.
  let stopGraceMs = 5000
  const applySettings = (value: { stopGraceSeconds: number }): void => {
    stopGraceMs = value.stopGraceSeconds * 1000
  }
  settings.get().then(applySettings, () => undefined)
  events.subscribe((event) => {
    if (event.type === 'settings-updated') applySettings(event.settings)
  })

  const system = systemDeps(env.platform, process.env)
  const shells = withPreferredShell(
    createShellLocator({
      ...system,
      startupDir: join(env.dataDir, 'shell'),
      writeFile: writeFileEnsuringDir
    }),
    async () => (await settings.get()).defaultShell
  )
  const editors = createEditorService({
    projects,
    locator: createEditorLocator(system),
    launch: launchDetached,
    env: process.env,
    platform: env.platform,
    customPath: async (editor) => (await settings.get()).editorPaths[editor],
    isFile
  })

  const killer = createProcessKiller({ platform: env.platform })
  // Remembers started processes so a session after a crash can offer to stop leftovers.
  const runRegistry = createRunRegistry({
    store: createJsonStore({
      filePath: join(env.dataDir, 'runs.json'),
      schema: runsFileSchema,
      fallback: emptyRunsFile
    }),
    readIdentities: createIdentityReader({ platform: env.platform }),
    killer
  })
  events.subscribe((event) => runRegistry.handle(event))

  const runs = createRunManager({
    scripts,
    projects,
    shells,
    spawn: nodePtySpawner,
    killer,
    platform: env.platform,
    emit: (event) => events.emit(event),
    graceMs: () => stopGraceMs
  })

  const groupService = createGroupService({
    store: createJsonStore({
      filePath: join(env.dataDir, 'groups.json'),
      schema: groupsFileSchema,
      fallback: emptyGroupsFile
    }),
    projects
  })
  const groupRunner = createGroupRunner({
    groups: groupService,
    runs,
    subscribe: (listener) => events.subscribe(listener),
    checkPort: checkLocalPort,
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
    listShells: async () => (await shells.list()).map(({ id, name }) => ({ id, name })),
    startShell: (projectId, shellId) => runs.startShell(projectId, shellId),
    stopRun: (runId) => runs.stop(runId),
    restartRun: (runId) => runs.restart(runId),
    listRuns: async () => runs.list(),
    listOrphanedRuns: () => runRegistry.orphans(),
    killOrphanedRuns: () => runRegistry.killOrphans(),
    dismissOrphanedRuns: () => runRegistry.dismissOrphans(),
    getRunOutput: async (runId) => runs.output(runId),
    writeRunInput: async (runId, data) => runs.writeInput(runId, data),
    resizeRun: async (runId, cols, rows) => runs.resize(runId, cols, rows),
    removeRun: async (runId) => runs.remove(runId),
    getSettings: () => settings.get(),
    updateSettings: (patch) => settings.update(patch),
    listGroups: () => groupService.list(),
    saveGroup: (input) => groupService.save(input),
    deleteGroup: async (groupId) => {
      await groupRunner.stop(groupId).catch(() => undefined)
      await groupService.remove(groupId)
    },
    startGroup: (groupId) => groupRunner.start(groupId),
    stopGroup: (groupId) => groupRunner.stop(groupId),
    listGroupStates: async () => groupRunner.states(),
    listEditors: () => editors.list(),
    openInEditor: (projectId, editor) => editors.open(projectId, editor),
    subscribe: (listener) => events.subscribe(listener),
    dispose: async () => {
      // Cancel sequences first so no step starts while the runs are being stopped.
      groupRunner.dispose()
      await runs.dispose()
    }
  }
}
