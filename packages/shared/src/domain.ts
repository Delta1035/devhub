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

/** Interactive shells a user can open in a project's terminal panel. */
export const shellIdSchema = z.enum([
  'git-bash',
  'pwsh',
  'powershell',
  'cmd',
  'bash',
  'zsh',
  'fish',
  'sh'
])
export type ShellId = z.infer<typeof shellIdSchema>

export const shellInfoSchema = z.object({ id: shellIdSchema, name: z.string() })
export type ShellInfo = z.infer<typeof shellInfoSchema>

export const runStatusSchema = z.enum(['running', 'stopping', 'exited'])
export type RunStatus = z.infer<typeof runStatusSchema>

const runBaseSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  /** Tab label: the script name, or "终端 N" for a shell. */
  title: z.string().min(1),
  /** What runs: the script's command line, or the shell executable. */
  command: z.string().min(1),
  status: runStatusSchema,
  pid: z.number().int(),
  /** Null while running, or when the process was force-killed without reporting a code. */
  exitCode: z.number().int().nullable(),
  /** True when the run ended because the user stopped it (not a crash or normal exit). */
  stopped: z.boolean(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().optional()
})

/**
 * One process in a terminal tab: a detected script (DevHub keeps the latest run per script;
 * starting it again replaces an exited run) or an interactive shell (any number per project).
 */
export const runSchema = z.discriminatedUnion('kind', [
  runBaseSchema.extend({ kind: z.literal('script'), scriptId: z.string().min(1) }),
  runBaseSchema.extend({ kind: z.literal('shell'), shellId: shellIdSchema })
])
export type Run = z.infer<typeof runSchema>

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

/** External editors/IDEs DevHub can open a project in. */
export const editorIdSchema = z.enum(['vscode', 'idea'])
export type EditorId = z.infer<typeof editorIdSchema>

export const editorInfoSchema = z.object({
  id: editorIdSchema,
  name: z.string(),
  /** False when no installation was found on this machine. */
  available: z.boolean()
})
export type EditorInfo = z.infer<typeof editorInfoSchema>

/** A local code directory managed by DevHub. */
export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Absolute, normalized directory path. */
  path: z.string().min(1),
  addedAt: z.iso.datetime()
})
export type Project = z.infer<typeof projectSchema>
