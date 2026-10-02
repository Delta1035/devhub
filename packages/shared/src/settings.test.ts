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

describe('custom shells in settings', () => {
  it('loads settings files written before custom shells existed', () => {
    const { customShells: _ignored, ...older } = defaultSettings
    void _ignored
    expect(settingsSchema.parse(older).customShells).toEqual([])
  })

  it('does not add customShells to a patch that does not mention them', () => {
    expect(settingsPatchSchema.parse({ stopGraceSeconds: 3 })).toEqual({ stopGraceSeconds: 3 })
  })

  it('accepts a custom shell as the default shell, and rejects malformed ids', () => {
    expect(settingsPatchSchema.safeParse({ defaultShell: 'custom-wsl' }).success).toBe(true)
    expect(settingsPatchSchema.safeParse({ defaultShell: 'custom-../x' }).success).toBe(false)
  })
})
