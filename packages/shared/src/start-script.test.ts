import { describe, expect, it, vi } from 'vitest'
import {
  defaultSettings,
  DevhubError,
  type DevhubApi,
  type PortConflictPolicy,
  type Script
} from './index'
import { PortConflictError, startScriptWithPortPolicy as startScript } from './start-script'

const script: Script = {
  id: 'custom:web',
  name: 'web',
  source: 'custom',
  command: 'node server.js',
  ports: [8080]
}
const input = { projectId: 'project', scriptId: script.id }
const conflict = { port: 8080, pid: 123, processName: 'node' }
const run = {
  id: 'run',
  projectId: input.projectId,
  kind: 'script' as const,
  scriptId: script.id,
  title: script.name,
  command: script.command,
  status: 'running' as const,
  pid: 456,
  exitCode: null,
  stopped: false,
  startedAt: '2026-01-01T00:00:00.000Z'
}

function fixture(global: PortConflictPolicy = 'error', override?: PortConflictPolicy) {
  const api = {
    getSettings: vi.fn<DevhubApi['getSettings']>().mockResolvedValue({
      ...defaultSettings,
      portConflictPolicy: global
    }),
    listScripts: vi.fn<DevhubApi['listScripts']>().mockResolvedValue({
      status: 'ok',
      scripts: [{ ...script, ...(override ? { portConflictPolicy: override } : {}) }],
      warnings: []
    }),
    checkScriptPorts: vi.fn<DevhubApi['checkScriptPorts']>().mockResolvedValue([conflict]),
    startScript: vi.fn<DevhubApi['startScript']>().mockResolvedValue(run)
  }
  return api
}

describe('startScript', () => {
  it('reports a default conflict before starting, preserving the UI choice', async () => {
    const api = fixture()
    await expect(startScript(api, input)).rejects.toMatchObject({
      name: 'PortConflictError',
      conflicts: [conflict]
    })
    expect(api.getSettings).toHaveBeenCalledOnce()
    expect(api.listScripts).toHaveBeenCalledWith(input.projectId)
    expect(api.checkScriptPorts).toHaveBeenCalledWith(input.projectId, input.scriptId)
    expect(api.startScript).not.toHaveBeenCalled()
  })

  it('starts after the default precheck finds no conflict', async () => {
    const api = fixture()
    api.checkScriptPorts.mockResolvedValue([])
    await expect(startScript(api, input)).resolves.toEqual(run)
    expect(api.checkScriptPorts.mock.invocationCallOrder[0]).toBeLessThan(
      api.startScript.mock.invocationCallOrder[0]!
    )
    expect(api.startScript).toHaveBeenCalledWith(input.projectId, input.scriptId, {
      ignorePortConflicts: undefined
    })
  })

  it.each([
    ['terminate', undefined],
    ['error', 'terminate']
  ] as const)(
    'lets the core release a conflict for global %s and script %s',
    async (global, override) => {
      const api = fixture(global, override)
      await expect(startScript(api, input)).resolves.toEqual(run)
      expect(api.checkScriptPorts).not.toHaveBeenCalled()
      expect(api.startScript).toHaveBeenCalledOnce()
    }
  )

  it('lets a script opt out of the global automatic policy', async () => {
    const api = fixture('terminate', 'error')
    await expect(startScript(api, input)).rejects.toBeInstanceOf(PortConflictError)
    expect(api.startScript).not.toHaveBeenCalled()
  })

  it('checks inferred ports even when automatic termination is enabled', async () => {
    const api = fixture('terminate')
    api.listScripts.mockResolvedValue({
      status: 'ok',
      warnings: [],
      scripts: [{ ...script, portsInferred: true }]
    })
    await expect(startScript(api, input)).rejects.toBeInstanceOf(PortConflictError)
    expect(api.checkScriptPorts).toHaveBeenCalledOnce()
    expect(api.startScript).not.toHaveBeenCalled()
  })

  it('reads settings and scripts again on each start', async () => {
    const api = fixture()
    await expect(startScript(api, input)).rejects.toBeInstanceOf(PortConflictError)
    api.getSettings.mockResolvedValue({ ...defaultSettings, portConflictPolicy: 'terminate' })
    await expect(startScript(api, input)).resolves.toEqual(run)
    api.listScripts.mockResolvedValue({
      status: 'ok',
      scripts: [{ ...script, portConflictPolicy: 'error' }],
      warnings: []
    })
    await expect(startScript(api, input)).rejects.toBeInstanceOf(PortConflictError)
    expect(api.startScript).toHaveBeenCalledOnce()
    expect(api.checkScriptPorts).toHaveBeenCalledTimes(2)
  })

  it('propagates release failures without offering to start anyway', async () => {
    const api = fixture('terminate')
    const failure = new DevhubError('PORT_RELEASE_FAILED', '无法结束占用端口的进程')
    api.startScript.mockRejectedValue(failure)
    await expect(startScript(api, input)).rejects.toBe(failure)
    expect(failure).not.toBeInstanceOf(PortConflictError)
    expect(api.checkScriptPorts).not.toHaveBeenCalled()
  })

  it('preserves an explicit start-anyway choice without prechecking', async () => {
    const api = fixture()
    await expect(startScript(api, { ...input, ignorePortConflicts: true })).resolves.toEqual(run)
    expect(api.getSettings).not.toHaveBeenCalled()
    expect(api.listScripts).not.toHaveBeenCalled()
    expect(api.checkScriptPorts).not.toHaveBeenCalled()
    expect(api.startScript).toHaveBeenCalledWith(input.projectId, input.scriptId, {
      ignorePortConflicts: true
    })
  })
})
