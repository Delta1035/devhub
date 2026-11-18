import { describe, expect, it } from 'vitest'
import type { IpcResult } from './api'
import type { PortConflictPolicy, Run, Script } from './domain'
import { createRemoteClient, RemoteError } from './remote-client'
import { defaultSettings } from './settings'
import { PortConflictError, startScriptWithPortPolicy } from './start-script'

const script: Script = {
  id: 'custom:web',
  name: 'web',
  source: 'custom',
  command: 'node server.js',
  ports: [8080]
}
const input = { projectId: 'project', scriptId: script.id }
const run: Run = {
  id: 'run',
  projectId: input.projectId,
  kind: 'script',
  scriptId: script.id,
  title: script.name,
  command: script.command,
  status: 'running',
  pid: 456,
  exitCode: null,
  stopped: false,
  startedAt: '2026-01-01T00:00:00.000Z'
}

function fixture(global: PortConflictPolicy, override?: PortConflictPolicy) {
  const requests: Array<{ method: string; args: unknown[] }> = []
  const responses: Record<string, IpcResult<unknown>> = {
    getSettings: { ok: true, value: { ...defaultSettings, portConflictPolicy: global } },
    listScripts: {
      ok: true,
      value: { status: 'ok', warnings: [], scripts: [{ ...script, portConflictPolicy: override }] }
    },
    checkScriptPorts: {
      ok: true,
      value: [{ port: 8080, pid: 123, processName: 'node' }]
    },
    startScript: { ok: true, value: run }
  }
  const client = createRemoteClient({
    baseUrl: 'http://desktop:3123',
    token: () => 'token',
    fetch: async (url, init) => {
      const method = url.split('/').at(-1) ?? ''
      const body: { args: unknown[] } = JSON.parse(init.body ?? '{}')
      requests.push({ method, args: body.args })
      expect(init.method).toBe('POST')
      expect(init.headers.authorization).toBe('Bearer token')
      const response = responses[method]
      if (!response) throw new Error(`Unexpected request: ${method}`)
      return { status: response.ok ? 200 : 409, body: null, json: async () => response }
    },
    createDecoder: () => () => '',
    delay: async () => {
      throw new Error('No event stream is used while starting a script')
    }
  })
  return { client, requests, responses }
}

describe('remote script startup used by the mobile client', () => {
  it.each([
    ['terminate', undefined],
    ['error', 'terminate']
  ] as const)('reaches the host when global is %s and script is %s', async (global, override) => {
    const { client, requests } = fixture(global, override)
    await expect(startScriptWithPortPolicy(client.api, input)).resolves.toEqual(run)
    expect(requests).toEqual([
      { method: 'getSettings', args: [] },
      { method: 'listScripts', args: [input.projectId] },
      { method: 'startScript', args: [input.projectId, input.scriptId, {}] }
    ])
  })

  it('preserves the mobile conflict dialog when the script overrides global termination', async () => {
    const { client, requests } = fixture('terminate', 'error')
    await expect(startScriptWithPortPolicy(client.api, input)).rejects.toBeInstanceOf(
      PortConflictError
    )
    expect(requests.at(-1)).toEqual({
      method: 'checkScriptPorts',
      args: [input.projectId, input.scriptId]
    })
    expect(requests.some((request) => request.method === 'startScript')).toBe(false)
  })

  it('shows a remote release failure without converting it to a start-anyway prompt', async () => {
    const { client, requests, responses } = fixture('terminate')
    responses.startScript = {
      ok: false,
      error: { code: 'PORT_RELEASE_FAILED', message: '没有权限结束占用进程' }
    }
    const failure = startScriptWithPortPolicy(client.api, input)
    await expect(failure).rejects.toBeInstanceOf(RemoteError)
    await expect(failure).rejects.toMatchObject({
      code: 'PORT_RELEASE_FAILED',
      message: '没有权限结束占用进程'
    })
    await expect(failure).rejects.not.toBeInstanceOf(PortConflictError)
    expect(requests.some((request) => request.method === 'checkScriptPorts')).toBe(false)
  })

  it('keeps an inferred port protected after loading scripts over HTTP', async () => {
    const { client, requests, responses } = fixture('terminate')
    responses.listScripts = {
      ok: true,
      value: { status: 'ok', warnings: [], scripts: [{ ...script, portsInferred: true }] }
    }
    await expect(startScriptWithPortPolicy(client.api, input)).rejects.toBeInstanceOf(
      PortConflictError
    )
    expect(requests.at(-1)?.method).toBe('checkScriptPorts')
    expect(requests.some((request) => request.method === 'startScript')).toBe(false)
  })
})
