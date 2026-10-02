import { describe, expect, it } from 'vitest'
import { defaultSettings, settingsPatchSchema, settingsSchema } from './settings'

describe('settingsSchema', () => {
  it('accepts the defaults', () => {
    expect(settingsSchema.parse(defaultSettings)).toEqual(defaultSettings)
  })

  it.each([
    [{ stopGraceSeconds: 0 }],
    [{ stopGraceSeconds: 61 }],
    [{ closeAction: 'minimize' }],
    [{ defaultShell: 'tcsh' }]
  ])('rejects %o', (patch) => {
    expect(settingsSchema.safeParse({ ...defaultSettings, ...patch }).success).toBe(false)
  })
})

describe('settingsPatchSchema', () => {
  it('allows updating one editor path alone', () => {
    const idea = 'D:\\IDEA\\bin\\idea64.exe'
    expect(settingsPatchSchema.parse({ editorPaths: { idea } })).toEqual({ editorPaths: { idea } })
  })

  it('allows an empty patch', () => {
    expect(settingsPatchSchema.parse({})).toEqual({})
  })
})
