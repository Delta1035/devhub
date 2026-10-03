import { z } from 'zod'

/** A script execution. Old records without a status are treated as finished. */
export const runRecordSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().min(1),
  scriptId: z.string().min(1),
  /** The command line it ran, which may have changed since. */
  command: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  status: z.enum(['running', 'finished', 'interrupted']).default('finished'),
  /** Null when the process was force-killed without reporting a code. */
  exitCode: z.number().int().nullable(),
  /** True when the user stopped it, as opposed to it exiting on its own. */
  stopped: z.boolean()
})
export type RunRecord = z.infer<typeof runRecordSchema>

/** How many finished runs are kept per script. */
export const runHistoryLimit = 20

/** Maximum UTF-8 bytes retained for one execution's historical output. */
export const runHistoryOutputLimit = 512 * 1024

export const runHistoryOutputSchema = z.object({
  data: z.string().max(runHistoryOutputLimit),
  truncated: z.boolean()
})
export type RunHistoryOutput = z.infer<typeof runHistoryOutputSchema>
