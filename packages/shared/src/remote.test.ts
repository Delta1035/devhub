import { describe, expect, it } from 'vitest'
import { devhubApiMethods } from './api'
import { isRemoteAllowed, remoteAccess, remoteConfigPatchSchema, remoteConnectUrl } from './remote'

describe('remoteConnectUrl', () => {
  it('puts the token in the fragment and brackets IPv6 hosts', () => {
    expect(remoteConnectUrl('100.64.1.2', 7420, 'a-b_c')).toBe(
      'http://100.64.1.2:7420/#token=a-b_c'
    )
    expect(remoteConnectUrl('fd7a:115c:a1e0::1', 7420, 't')).toBe(
      'http://[fd7a:115c:a1e0::1]:7420/#token=t'
    )
  })
})

describe('remoteConfigPatchSchema', () => {
  it.each([{ port: 80 }, { port: 70000 }, { host: '' }, { token: 'mine' }, { enabled: 'yes' }])(
    'rejects %o',
    (patch) => {
      expect(remoteConfigPatchSchema.safeParse(patch).success).toBe(false)
    }
  )

  it('accepts a partial change', () => {
    expect(remoteConfigPatchSchema.parse({ enabled: true })).toEqual({ enabled: true })
  })
})

describe('remoteAccess', () => {
  it('classifies exactly the API methods', () => {
    expect(Object.keys(remoteAccess).sort()).toEqual([...devhubApiMethods].sort())
  })

  it.each([
    'addProject',
    'addWorkspace',
    'updateWorkspace',
    'updateSettings',
    'saveGroup',
    'openInEditor',
    'openInSystemTerminal',
    'getRemoteState',
    'updateRemoteConfig',
    'regenerateRemoteToken'
  ] as const)('never exposes %s, which changes or launches what runs on the host', (method) => {
    expect(isRemoteAllowed(method, { allowTerminal: true })).toBe(false)
  })

  it('exposes terminal methods only when remote terminals are allowed', () => {
    for (const method of ['startShell', 'writeRunInput'] as const) {
      expect(isRemoteAllowed(method, { allowTerminal: false })).toBe(false)
      expect(isRemoteAllowed(method, { allowTerminal: true })).toBe(true)
    }
  })

  it('exposes reading and controlling registered scripts', () => {
    for (const method of ['listRuns', 'getRunOutput', 'startScript', 'stopRun'] as const) {
      expect(isRemoteAllowed(method, { allowTerminal: false })).toBe(true)
    }
  })
})
