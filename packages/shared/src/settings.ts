import { z } from 'zod'
import { customShellIdSchema, shellIdSchema } from './domain'

/** A shell the user added: any program run interactively in the project directory. */
export const customShellSchema = z.object({
  id: customShellIdSchema,
  name: z.string().trim().min(1).max(30),
  path: z.string().min(1),
  args: z.array(z.string().max(500)).max(20)
})
export type CustomShell = z.infer<typeof customShellSchema>

/**
 * Settings that change what the core does on this machine; stored by the core in
 * `userData/settings.json`. Display preferences (theme, font size…) stay in the UI, per device.
 */
export const settingsSchema = z.object({
  /** Shell opened by "+"; null means the first one detected (Git Bash / bash). */
  defaultShell: shellIdSchema.nullable(),
  /** Executables chosen by the user; null means auto-detect. */
  editorPaths: z.object({
    vscode: z.string().nullable(),
    idea: z.string().nullable()
  }),
  /** Seconds a stopped script gets to exit after Ctrl+C before its tree is force-killed. */
  stopGraceSeconds: z.number().int().min(1).max(60),
  /** Closing the window: keep running in the tray, or quit (stopping every run). */
  closeAction: z.enum(['tray', 'quit']),
  /** Defaults to none, so settings files written before this field existed still load. */
  customShells: z.array(customShellSchema).max(10).default([])
})
export type Settings = z.infer<typeof settingsSchema>

export const defaultSettings: Settings = {
  defaultShell: null,
  editorPaths: { vscode: null, idea: null },
  stopGraceSeconds: 5,
  closeAction: 'tray',
  customShells: []
}

/**
 * A partial update; `editorPaths` may set either editor alone. `customShells` is redeclared
 * without its default: under `.partial()` the default would still fill in `[]` and every
 * unrelated update would erase the user's shells.
 */
export const settingsPatchSchema = settingsSchema
  .extend({
    editorPaths: settingsSchema.shape.editorPaths.partial(),
    customShells: z.array(customShellSchema).max(10)
  })
  .partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
