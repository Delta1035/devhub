import { z } from 'zod'

/** One finished run of a script, kept so the user can see how earlier runs ended. */
export const runRecordSchema = z.object({
  runId: z.string().min(1),
  projectId: z.string().min(1),
  scriptId: z.string().min(1),
  /** The command line it ran, which may have changed since. */
  command: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  /** Null when the process was force-killed without reporting a code. */
  exitCode: z.number().int().nullable(),
  /** True when the user stopped it, as opposed to it exiting on its own. */
  stopped: z.boolean()
})
export type RunRecord = z.infer<typeof runRecordSchema>

/** How many finished runs are kept per script. */
export const runHistoryLimit = 20
