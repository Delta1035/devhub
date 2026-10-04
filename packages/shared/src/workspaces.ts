import { z } from 'zod'

/** How many directory levels below a workspace root are searched for projects. */
export const workspaceDepthMin = 1
export const workspaceDepthMax = 5
export const defaultWorkspaceDepth = 1
export const workspaceDepthSchema = z.number().int().min(workspaceDepthMin).max(workspaceDepthMax)

/**
 * A directory whose projects DevHub discovers and keeps in sync. Discovered projects are stored
 * as ordinary projects (with `workspaceId`), so groups and history keep stable project ids.
 */
export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Absolute, normalized directory path. */
  path: z.string().min(1),
  depth: workspaceDepthSchema,
  /** Project paths the user removed; rescans do not add them back. */
  excluded: z.array(z.string().min(1)),
  addedAt: z.iso.datetime()
})
export type Workspace = z.infer<typeof workspaceSchema>

/** What can be changed after adding; every change rescans the workspace. */
export const workspacePatchSchema = z
  .object({
    depth: workspaceDepthSchema,
    /** Removing a path from the list lets the next scan add that project again. */
    excluded: z.array(z.string().min(1)).max(1000)
  })
  .partial()
export type WorkspacePatch = z.infer<typeof workspacePatchSchema>

/** Outcome of the latest scan in this session; kept in memory only. */
export const workspaceScanSchema = z.object({
  scannedAt: z.iso.datetime(),
  /** False when the root could not be read; its projects were left untouched. */
  available: z.boolean(),
  /** False when part of the tree was unreadable or too large; no project was removed. */
  complete: z.boolean(),
  warnings: z.array(z.string())
})
export type WorkspaceScan = z.infer<typeof workspaceScanSchema>

export const workspaceViewSchema = workspaceSchema.extend({
  /** Null until the workspace has been scanned in this session. */
  scan: workspaceScanSchema.nullable()
})
export type WorkspaceView = z.infer<typeof workspaceViewSchema>
