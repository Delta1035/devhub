import { z } from 'zod'
import { shellIdSchema } from './domain'

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
  closeAction: z.enum(['tray', 'quit'])
})
export type Settings = z.infer<typeof settingsSchema>

export const defaultSettings: Settings = {
  defaultShell: null,
  editorPaths: { vscode: null, idea: null },
  stopGraceSeconds: 5,
  closeAction: 'tray'
}

/** A partial update; `editorPaths` may set either editor alone. */
export const settingsPatchSchema = settingsSchema
  .extend({ editorPaths: settingsSchema.shape.editorPaths.partial() })
  .partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
