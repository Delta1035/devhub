import type { DevhubApi } from './api'
import type { PortConflict, Run } from './domain'
import { describePortConflicts } from './ports'

/** A script's port is taken; the UI offers to start it anyway. */
export class PortConflictError extends Error {
  constructor(readonly conflicts: PortConflict[]) {
    super(describePortConflicts(conflicts))
    this.name = 'PortConflictError'
  }
}

export interface StartScriptInput {
  projectId: string
  scriptId: string
  ignorePortConflicts?: boolean
}

type StartScriptApi = Pick<
  DevhubApi,
  'startScript' | 'checkScriptPorts' | 'getSettings' | 'listScripts'
>

/** Reads the current policy so the UI cannot prevent the core from releasing a port. */
export async function startScriptWithPortPolicy(
  api: StartScriptApi,
  input: StartScriptInput
): Promise<Run> {
  const { projectId, scriptId, ignorePortConflicts } = input
  if (!ignorePortConflicts) {
    const [settings, detected] = await Promise.all([api.getSettings(), api.listScripts(projectId)])
    const script = detected.scripts.find((entry) => entry.id === scriptId)
    const policy = script?.portConflictPolicy ?? settings.portConflictPolicy
    if (policy === 'error' || script?.portsInferred) {
      const conflicts = await api.checkScriptPorts(projectId, scriptId)
      if (conflicts.length > 0) throw new PortConflictError(conflicts)
    }
  }
  return api.startScript(projectId, scriptId, { ignorePortConflicts })
}
