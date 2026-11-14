import type {
  DevhubApi,
  Group,
  GroupInput,
  GroupRunState,
  Project,
  ProjectScripts,
  Run,
  RunHealth,
  RunHistoryOutput,
  RunOutputSnapshot,
  RunRecord,
  ShellInfo
} from '@devhub/shared'
import {
  createMockRunHistory,
  mockGroups,
  mockProjects,
  mockRuns,
  mockScripts,
  sampleFailedOutput,
  sampleTerminalOutput
} from './mock-data'
import { mockEvents } from './mock-events'
import {
  mockAddWorkspace,
  mockGetAppInfo,
  mockGetRemoteState,
  mockGetSettings,
  mockGetSystemTerminal,
  mockListEditors,
  mockListWorkspaces,
  mockOpenInEditor,
  mockOpenInSystemTerminal,
  mockRegenerateRemoteToken,
  mockRemoveWorkspace,
  mockRescanWorkspaces,
  mockUpdateRemoteConfig,
  mockUpdateSettings,
  mockUpdateWorkspace
} from './mock-helpers'

export { mockEvents }

export function createMockApi(): DevhubApi {
  const projects = [...mockProjects]
  const runs = [...mockRuns]
  const groups = [...mockGroups]
  let nextRunId = 100

  return {
    getAppInfo: mockGetAppInfo,
    async listProjects(): Promise<Project[]> {
      return [...projects]
    },
    async addProject(projectPath: string): Promise<Project> {
      const name = projectPath.split(/[\\/]/).filter(Boolean).pop() ?? 'new-project'
      const proj: Project = {
        id: `proj-${Date.now()}`,
        name,
        path: projectPath,
        addedAt: new Date().toISOString()
      }
      projects.push(proj)
      mockEvents.emit({ type: 'projects-updated' })
      return proj
    },
    async setProjectPinned(projectId: string, pinned: boolean): Promise<Project> {
      const p = projects.find((x) => x.id === projectId)
      if (p) {
        if (pinned) {
          p.pinnedAt = new Date().toISOString()
        } else {
          delete p.pinnedAt
        }
        mockEvents.emit({ type: 'projects-updated' })
        return p
      }
      return (
        projects[0] ?? {
          id: projectId,
          name: 'project',
          path: 'D:\\demo',
          addedAt: new Date().toISOString()
        }
      )
    },
    async removeProject(projectId: string): Promise<void> {
      const idx = projects.findIndex((x) => x.id === projectId)
      if (idx !== -1) projects.splice(idx, 1)
      mockEvents.emit({ type: 'projects-updated' })
    },
    listWorkspaces: mockListWorkspaces,
    addWorkspace: mockAddWorkspace,
    updateWorkspace: mockUpdateWorkspace,
    removeWorkspace: mockRemoveWorkspace,
    rescanWorkspaces: mockRescanWorkspaces,
    async listScripts(projectId: string): Promise<ProjectScripts> {
      const result = mockScripts[projectId]
      if (result) return result
      return { status: 'ok', scripts: [], warnings: [] }
    },
    async startScript(projectId: string, scriptId: string): Promise<Run> {
      const s = (mockScripts[projectId]?.scripts ?? []).find((x) => x.id === scriptId)
      const existing = runs.find(
        (r) => r.kind === 'script' && r.projectId === projectId && r.scriptId === scriptId
      )
      if (existing && existing.status !== 'exited') return existing

      const newRun: Run = {
        kind: 'script',
        id: `run-${++nextRunId}`,
        projectId,
        scriptId,
        title: s?.name ?? scriptId,
        command: s?.command ?? 'npm run ' + scriptId,
        status: 'running',
        startedAt: new Date().toISOString(),
        pid: 20000 + nextRunId,
        exitCode: null,
        stopped: false
      }
      runs.push(newRun)
      mockEvents.emit({ type: 'run-updated', run: newRun })
      setTimeout(() => {
        mockEvents.emit({
          type: 'run-output',
          runId: newRun.id,
          offset: 0,
          data: sampleTerminalOutput
        })
      }, 100)
      return newRun
    },
    async checkScriptPorts(projectId: string, scriptId: string) {
      void projectId
      void scriptId
      return []
    },
    async listShells(): Promise<ShellInfo[]> {
      return [
        { id: 'pwsh', name: 'PowerShell' },
        { id: 'cmd', name: 'Command Prompt' }
      ]
    },
    async startShell(projectId: string): Promise<Run> {
      const newRun: Run = {
        kind: 'shell',
        id: `shell-${++nextRunId}`,
        projectId,
        shellId: 'pwsh',
        title: 'pwsh',
        command: 'pwsh.exe',
        status: 'running',
        startedAt: new Date().toISOString(),
        pid: 30000 + nextRunId,
        exitCode: null,
        stopped: false
      }
      runs.push(newRun)
      mockEvents.emit({ type: 'run-updated', run: newRun })
      return newRun
    },
    async stopRun(runId: string): Promise<void> {
      const r = runs.find((x) => x.id === runId)
      if (r) {
        r.status = 'exited'
        r.stopped = true
        r.exitCode = 0
        mockEvents.emit({ type: 'run-updated', run: r })
      }
    },
    async restartRun(runId: string): Promise<Run> {
      const r = runs.find((x) => x.id === runId)
      if (r) {
        r.status = 'running'
        r.startedAt = new Date().toISOString()
        mockEvents.emit({ type: 'run-updated', run: r })
        return r
      }
      return (
        runs[0] ?? {
          kind: 'script',
          id: runId,
          projectId: 'proj-shop-web',
          scriptId: 'dev',
          title: 'dev',
          command: 'pnpm run dev',
          status: 'running',
          startedAt: new Date().toISOString(),
          pid: 51730,
          exitCode: null,
          stopped: false
        }
      )
    },
    async listOrphanedRuns() {
      return []
    },
    async killOrphanedRuns(): Promise<void> {
      await Promise.resolve()
    },
    async dismissOrphanedRuns(): Promise<void> {
      await Promise.resolve()
    },
    async listRuns(): Promise<Run[]> {
      return [...runs]
    },
    async listRunHistory(projectId: string, scriptId: string): Promise<RunRecord[]> {
      return createMockRunHistory(projectId, scriptId)
    },
    async clearRunHistory(projectId: string, scriptId: string): Promise<void> {
      void projectId
      void scriptId
      await Promise.resolve()
    },
    async getRunHistoryOutput(
      _projId: string,
      scriptId: string,
      _runId: string
    ): Promise<RunHistoryOutput | null> {
      void _projId
      void _runId
      return {
        data: scriptId === 'lint' ? sampleFailedOutput : sampleTerminalOutput,
        truncated: false
      }
    },
    async listRunHealth(): Promise<RunHealth[]> {
      return [
        {
          runId: 'run-dev',
          state: 'ready',
          target: '端口 5173',
          since: new Date(Date.now() - 130000).toISOString()
        },
        {
          runId: 'run-boot',
          state: 'ready',
          target: '端口 8080',
          since: new Date(Date.now() - 40000).toISOString()
        }
      ]
    },
    async getRunOutput(runId: string): Promise<RunOutputSnapshot> {
      const data = runId.includes('lint') ? sampleFailedOutput : sampleTerminalOutput
      return { data, end: data.length }
    },
    async writeRunInput(runId: string, data: string): Promise<void> {
      mockEvents.emit({
        type: 'run-output',
        runId,
        offset: 0,
        data: `\r\n\x1b[32m[input]\x1b[0m ${data}`
      })
    },
    async resizeRun(runId: string, cols: number, rows: number): Promise<void> {
      void runId
      void cols
      void rows
      await Promise.resolve()
    },
    async removeRun(runId: string): Promise<void> {
      const idx = runs.findIndex((x) => x.id === runId)
      if (idx !== -1) {
        runs.splice(idx, 1)
        mockEvents.emit({ type: 'run-removed', runId })
      }
    },
    getSettings: mockGetSettings,
    updateSettings: mockUpdateSettings,
    async listGroups(): Promise<Group[]> {
      return [...groups]
    },
    async saveGroup(input: GroupInput): Promise<Group> {
      const id = input.id ?? `grp-${Date.now()}`
      const existingIdx = groups.findIndex((g) => g.id === id)
      const existing = existingIdx !== -1 ? groups[existingIdx] : undefined
      const group: Group = {
        id,
        name: input.name,
        mode: input.mode,
        pinnedAt: existing?.pinnedAt,
        steps: input.steps.map((s, idx) => ({
          id: `step-${idx + 1}`,
          projectId: s.projectId,
          scriptId: s.scriptId,
          continueWhen: s.continueWhen
        }))
      }
      if (existingIdx !== -1) groups[existingIdx] = group
      else groups.push(group)
      mockEvents.emit({ type: 'groups-updated' })
      return group
    },
    async setGroupPinned(groupId: string, pinned: boolean): Promise<Group> {
      const g = groups.find((x) => x.id === groupId)
      if (g) {
        if (pinned) {
          g.pinnedAt = new Date().toISOString()
        } else {
          delete g.pinnedAt
        }
        mockEvents.emit({ type: 'groups-updated' })
        return g
      }
      return (
        groups[0] ?? {
          id: groupId,
          name: 'group',
          mode: 'parallel',
          steps: []
        }
      )
    },
    async deleteGroup(groupId: string): Promise<void> {
      const idx = groups.findIndex((x) => x.id === groupId)
      if (idx !== -1) groups.splice(idx, 1)
      mockEvents.emit({ type: 'groups-updated' })
    },
    async startGroup(groupId: string): Promise<GroupRunState> {
      const g = groups.find((x) => x.id === groupId)
      const state: GroupRunState = {
        groupId,
        group: g,
        status: 'running',
        steps: (g?.steps ?? []).map((step, idx) => ({
          stepId: step.id,
          state: idx === 0 ? 'running' : 'pending'
        }))
      }
      mockEvents.emit({ type: 'group-updated', state })
      return state
    },
    async stopGroup(groupId: string): Promise<void> {
      const g = groups.find((x) => x.id === groupId)
      mockEvents.emit({
        type: 'group-updated',
        state: {
          groupId,
          group: g,
          status: 'stopped',
          finishedAt: new Date().toISOString(),
          steps: (g?.steps ?? []).map((step) => ({
            stepId: step.id,
            state: 'cancelled'
          }))
        }
      })
    },
    async listGroupStates(): Promise<GroupRunState[]> {
      const g = groups.find((x) => x.id === 'grp-fullstack')
      return [
        {
          groupId: 'grp-fullstack',
          group: g,
          status: 'running',
          steps: (g?.steps ?? []).map((step, idx) => ({
            stepId: step.id,
            state: idx === 0 ? 'done' : idx === 1 ? 'running' : 'pending'
          }))
        }
      ]
    },
    listEditors: mockListEditors,
    openInEditor: mockOpenInEditor,
    getSystemTerminal: mockGetSystemTerminal,
    openInSystemTerminal: mockOpenInSystemTerminal,
    getRemoteState: mockGetRemoteState,
    updateRemoteConfig: mockUpdateRemoteConfig,
    regenerateRemoteToken: mockRegenerateRemoteToken
  }
}
