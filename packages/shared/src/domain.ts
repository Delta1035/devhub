import { z } from 'zod'

/** Where a script was discovered. Each source maps to one detector in the desktop main process. */
export const scriptSourceSchema = z.enum(['npm', 'maven', 'gradle', 'custom'])
export type ScriptSource = z.infer<typeof scriptSourceSchema>

/** A runnable command inside a project, either auto-detected or user-defined. */
export const scriptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: scriptSourceSchema,
  command: z.string().min(1),
  cwd: z.string().optional(),
  /** Human-readable detail, e.g. the raw npm script body. */
  description: z.string().optional()
})
export type Script = z.infer<typeof scriptSchema>

/** A detector that failed (e.g. malformed package.json); other detectors still contribute. */
export const scriptWarningSchema = z.object({
  source: scriptSourceSchema,
  message: z.string()
})
export type ScriptWarning = z.infer<typeof scriptWarningSchema>

/** Result of scanning a project directory. `missing` means the directory no longer exists. */
export const projectScriptsSchema = z.object({
  status: z.enum(['ok', 'missing']),
  scripts: z.array(scriptSchema),
  warnings: z.array(scriptWarningSchema)
})
export type ProjectScripts = z.infer<typeof projectScriptsSchema>

/** A named set of overrides used to point a project at a different backend. */
export const profileSchema = z.object({
  name: z.string().min(1),
  env: z.record(z.string(), z.string()).default({}),
  args: z.array(z.string()).default([])
})
export type Profile = z.infer<typeof profileSchema>

/** Schema of the optional `.devhub.yaml` file committed in a managed project. */
export const projectConfigSchema = z.object({
  scripts: z
    .record(
      z.string(),
      z.object({
        command: z.string().min(1),
        cwd: z.string().optional()
      })
    )
    .default({}),
  profiles: z.array(profileSchema).default([])
})
export type ProjectConfig = z.infer<typeof projectConfigSchema>

/** A local code directory managed by DevHub. */
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Absolute, normalized directory path. */
  path: z.string().min(1),
  addedAt: z.iso.datetime()
})
export type Project = z.infer<typeof projectSchema>
