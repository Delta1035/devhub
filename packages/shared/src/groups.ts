import { z } from 'zod'

/**
 * Batch runs ("groups"): a named list of scripts, possibly from several projects, started
 * together in parallel or one after another.
 */
function isValidRegex(source: string): boolean {
  try {
    new RegExp(source)
    return true
  } catch {
    return false
  }
}

export const groupModeSchema = z.enum(['parallel', 'serial'])
export type GroupMode = z.infer<typeof groupModeSchema>

const timeoutSeconds = z.number().int().min(1).max(3600)

/** When a serial group may move on from a step to the next one. */
export const continueConditionSchema = z.discriminatedUnion('type', [
  /** The script exits with code 0 (installs, builds, migrations). */
  z.object({ type: z.literal('exit'), timeoutSeconds }),
  /** The script prints this text (servers: "Started Application", "ready in"). */
  z
    .object({
      type: z.literal('output'),
      text: z.string().trim().min(1).max(200),
      /** Treat `text` as a regular expression, e.g. `Started .* in \d+`. */
      regex: z.boolean().optional(),
      timeoutSeconds
    })
    .refine((condition) => !condition.regex || isValidRegex(condition.text), {
      message: '正则表达式无效',
      path: ['text']
    }),
  /** A TCP connection to this local port succeeds. */
  z.object({ type: z.literal('port'), port: z.number().int().min(1).max(65535), timeoutSeconds }),
  /** A GET to this URL answers 2xx (health endpoints: `/actuator/health`, `/healthz`). */
  z.object({
    type: z.literal('http'),
    url: z.url({ protocol: /^https?$/, error: '请填写 http:// 或 https:// 开头的地址' }).max(500),
    timeoutSeconds
  }),
  /** A fixed pause. */
  z.object({ type: z.literal('delay'), seconds: z.number().int().min(0).max(3600) })
])
export type ContinueCondition = z.infer<typeof continueConditionSchema>

export const defaultTimeoutSeconds = 120

export const groupStepInputSchema = z.object({
  projectId: z.string().min(1),
  scriptId: z.string().min(1),
  /** Only used in serial mode. */
  continueWhen: continueConditionSchema
})
export type GroupStepInput = z.infer<typeof groupStepInputSchema>

export const groupStepSchema = groupStepInputSchema.extend({ id: z.string().min(1) })
export type GroupStep = z.infer<typeof groupStepSchema>

/** What the UI sends to create (no id) or update (with id) a group. */
export const groupInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60),
  mode: groupModeSchema,
  steps: z.array(groupStepInputSchema).min(1).max(50)
})
export type GroupInput = z.infer<typeof groupInputSchema>

export const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: groupModeSchema,
  steps: z.array(groupStepSchema)
})
export type Group = z.infer<typeof groupSchema>

export const groupStepStateSchema = z.enum(['pending', 'running', 'done', 'failed', 'cancelled'])
export type GroupStepState = z.infer<typeof groupStepStateSchema>

/** Latest execution progress; completed results are persisted across sessions. */
export const groupRunStateSchema = z.object({
  groupId: z.string(),
  /** Configuration at execution time; absent in older saved results. */
  group: groupSchema.optional(),
  status: z.enum(['running', 'done', 'failed', 'stopped']),
  /** When the execution ended; absent while running. */
  finishedAt: z.iso.datetime().optional(),
  steps: z.array(
    z.object({
      stepId: z.string(),
      state: groupStepStateSchema,
      /** The run started (or reused) for this step. */
      runId: z.string().optional(),
      /** Whether this step reused an existing active run; absent in older results. */
      reused: z.boolean().optional(),
      /** Why a step is waiting or failed, e.g. `等待输出 "ready"`. */
      message: z.string().optional()
    })
  )
})
export type GroupRunState = z.infer<typeof groupRunStateSchema>
