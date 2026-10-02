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
  description: z.string().optional(),
  /** Ports the script is expected to listen on (inferred), checked before it starts. */
  ports: z.array(z.number().int().min(1).max(65535)).optional()
})
export type Script = z.infer<typeof scriptSchema>

/** A port a script needs that something else already listens on. */
export const portConflictSchema = z.object({
  port: z.number().int(),
  /** The listening process, when the OS tells us. */
  pid: z.number().int().nullable(),
  processName: z.string().nullable()
})
export type PortConflict = z.infer<typeof portConflictSchema>

export interface StartScriptOptions {
  /** Start even though a port the script needs is taken (the user chose "start anyway"). */
  ignorePortConflicts?: boolean
}

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
export const builtinShellIdSchema = z.enum([
  'git-bash',
  'pwsh',
  'powershell',
  'cmd',
  'bash',
  'zsh',
  'fish',
  'sh'
])

/** Ids of shells the user added in settings. */
export const customShellIdSchema = z.string().regex(/^custom-[a-z0-9]{1,24}$/)

export const shellIdSchema = z.union([builtinShellIdSchema, customShellIdSchema])
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

/** A command, or one per platform (`mvnw.cmd …` on Windows, `./mvnw …` on Linux). */
const configCommandSchema = z.union([
  z.string().trim().min(1),
  z
    .object({ windows: z.string().trim().min(1), linux: z.string().trim().min(1) })
    .partial()
    .refine((command) => command.windows || command.linux, '至少填写 windows 或 linux')
])

/** Schema of the optional `.devhub.yaml` file committed in a managed project. */
export const projectConfigSchema = z
  .object({
    scripts: z
      .record(
        z.string().trim().min(1).max(60),
        z
          .object({
            command: configCommandSchema,
            /** Relative to the project; must stay inside it. */
            cwd: z.string().optional(),
            description: z.string().optional(),
            /** Ports checked before starting; inferred from the command when omitted. */
            port: z.number().int().min(1).max(65535).optional(),
            ports: z.array(z.number().int().min(1).max(65535)).optional()
          })
          .strict()
      )
      .default({})
  })
  .strict()
export type ProjectConfig = z.infer<typeof projectConfigSchema>

/**
 * A process DevHub started in an earlier session that is still alive, because DevHub crashed
 * or was killed before it could stop it.
 */
export const orphanedRunSchema = z.object({
  pid: z.number().int(),
  projectId: z.string(),
  title: z.string(),
  command: z.string(),
  startedAt: z.iso.datetime()
})
export type OrphanedRun = z.infer<typeof orphanedRunSchema>

/** External editors/IDEs DevHub can open a project in. */
export const editorIdSchema = z.enum(['vscode', 'idea'])
export type EditorId = z.infer<typeof editorIdSchema>

export const editorInfoSchema = z.object({
  id: editorIdSchema,
  name: z.string(),
  /** False when no installation was found on this machine. */
  available: z.boolean(),
  /** The executable that will be launched, if any. */
  path: z.string().nullable(),
  /** True when `path` comes from the user's settings rather than auto-detection. */
  custom: z.boolean()
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
