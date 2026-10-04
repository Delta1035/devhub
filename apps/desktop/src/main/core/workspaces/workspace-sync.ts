import type { Project, Workspace } from '@devhub/shared'
import { samePath } from '../fs/path-compare'
import type { ScanResult } from './workspace-scanner'

export interface SyncPlan {
  /** Newly discovered project paths. */
  add: string[]
  remove: Project[]
}

export interface PlanSyncInput {
  workspace: Workspace
  scan: ScanResult
  /** Every project, including those added by hand. */
  projects: Project[]
  platform: NodeJS.Platform
  /** True while the project has a script or shell that has not exited. */
  isActive: (projectId: string) => boolean
  isDirectory: (path: string) => Promise<boolean>
}

/**
 * Decides how a scan changes the workspace's projects. Removal is deliberately cautious, since
 * it also deletes run history: a project stays when its directory is gone (a branch switch or an
 * unplugged drive should not wipe it; it shows as missing), when the scan was incomplete, or
 * while it is running. Paths the user excluded always go.
 */
export async function planSync({
  workspace,
  scan,
  projects,
  platform,
  isActive,
  isDirectory
}: PlanSyncInput): Promise<SyncPlan> {
  if (scan.status === 'unavailable') return { add: [], remove: [] }

  const excluded = (path: string): boolean =>
    workspace.excluded.some((entry) => samePath(entry, path, platform))
  const found = (path: string): boolean =>
    scan.projects.some((entry) => samePath(entry, path, platform))

  // A directory already registered (by hand or by another workspace) keeps its project.
  const add = scan.projects.filter(
    (path) => !excluded(path) && !projects.some((project) => samePath(project.path, path, platform))
  )

  const remove: Project[] = []
  for (const project of projects) {
    if (project.workspaceId !== workspace.id) continue
    if (excluded(project.path)) remove.push(project)
    else if (found(project.path) || !scan.complete || isActive(project.id)) continue
    else if (await stillExists(project.path, isDirectory)) remove.push(project)
  }
  return { add, remove }
}

async function stillExists(
  path: string,
  isDirectory: (path: string) => Promise<boolean>
): Promise<boolean> {
  try {
    return await isDirectory(path)
  } catch {
    // Unknown state (permissions, I/O error): keep the project rather than lose its history.
    return false
  }
}
