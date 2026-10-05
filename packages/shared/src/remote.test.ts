import { describe, expect, it } from 'vitest'
import { devhubApiMethods } from './api'
import { isRemoteAllowed, remoteAccess } from './remote'

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
    'openInSystemTerminal'
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
