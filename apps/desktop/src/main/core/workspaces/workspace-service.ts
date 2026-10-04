import { randomUUID } from 'crypto'
import { basename, isAbsolute, resolve } from 'path'
import { z } from 'zod'
import {
  defaultWorkspaceDepth,
  DevhubError,
  workspaceDepthSchema,
  workspacePatchSchema,
  workspaceSchema,
  type DevhubEvent,
  type Workspace,
  type WorkspaceScan,
  type WorkspaceView
} from '@devhub/shared'
import { assertDirectory } from '../fs/assert-directory'
import { isWithin, samePath } from '../fs/path-compare'
import type { ProjectService } from '../projects/project-service'
import type { JsonStore } from '../storage/json-store'
import type { ScanResult } from './workspace-scanner'
import { planSync } from './workspace-sync'

export const workspacesFileSchema = z.object({
  version: z.literal(1),
  workspaces: z.array(workspaceSchema)
})
export type WorkspacesFile = z.infer<typeof workspacesFileSchema>

export const emptyWorkspacesFile = (): WorkspacesFile => ({ version: 1, workspaces: [] })

export interface WorkspaceService {
  list(): Promise<WorkspaceView[]>
  add(path: unknown, depth?: unknown): Promise<WorkspaceView>
  update(workspaceId: unknown, patch: unknown): Promise<WorkspaceView>
  remove(workspaceId: unknown): Promise<void>
  /** Concurrent calls share one pending rescan. */
  rescanAll(): Promise<WorkspaceView[]>
  /**
   * Removes any project. One inside a workspace is excluded there first, whether it was
   * discovered or added by hand, so the next scan does not bring it back.
   */
  removeProject(projectId: unknown): Promise<void>
  /** Resolves once queued operations have finished. */
  flush(): Promise<void>
}

export interface WorkspaceServiceDeps {
  store: JsonStore<WorkspacesFile>
  projects: ProjectService
  platform: NodeJS.Platform
  scan: (root: string, depth: number) => Promise<ScanResult>
  isActive: (projectId: string) => boolean
  isDirectory: (path: string) => Promise<boolean>
  /** Deletes the run history of a removed project. */
  forgetProject: (projectId: string) => Promise<void>
  emit: (event: DevhubEvent) => void
  now?: () => Date
  newId?: () => string
}

const idInput = z.string().min(1)
const pathInput = z.string().trim().min(1).refine(isAbsolute)
const absolutePaths = z.array(pathInput)

export function createWorkspaceService(deps: WorkspaceServiceDeps): WorkspaceService {
  const { store, projects, platform, emit, now = () => new Date(), newId = randomUUID } = deps
  let cache: WorkspacesFile | null = null
  const scans = new Map<string, WorkspaceScan>()
  // One queue for every operation: scans read and change projects and workspaces together.
  let queue: Promise<unknown> = Promise.resolve()
  let pendingRescan: Promise<WorkspaceView[]> | null = null

  const load = async (): Promise<WorkspacesFile> => (cache ??= await store.read())

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn)
    queue = next.catch(() => undefined)
    return next
  }

  const view = (workspace: Workspace): WorkspaceView =>
    structuredClone({ ...workspace, scan: scans.get(workspace.id) ?? null })

  const find = (data: WorkspacesFile, rawId: unknown): Workspace => {
    const parsed = idInput.safeParse(rawId)
    const workspace = parsed.success
      ? data.workspaces.find((candidate) => candidate.id === parsed.data)
      : undefined
    if (!workspace) throw new DevhubError('WORKSPACE_NOT_FOUND', '工作区不存在或已被移除')
    return workspace
  }

  const forget = async (projectIds: string[]): Promise<void> => {
    for (const id of projectIds) await deps.forgetProject(id)
  }

  /** Scans one workspace and applies the result. True when anything visible changed. */
  const sync = async (workspace: Workspace): Promise<boolean> => {
    const result = await deps.scan(workspace.path, workspace.depth)
    const plan = await planSync({
      workspace,
      scan: result,
      projects: await projects.list(),
      platform,
      isActive: deps.isActive,
      isDirectory: deps.isDirectory
    })
    if (plan.remove.length > 0) {
      const removed = await projects.removeMany(plan.remove.map((project) => project.id))
      await forget(removed.map((project) => project.id))
    }
    if (plan.add.length > 0) await projects.addDiscovered(plan.add, workspace.id)

    const scan = toScanState(result, now())
    const previous = scans.get(workspace.id)
    scans.set(workspace.id, scan)
    return plan.add.length > 0 || plan.remove.length > 0 || !sameOutcome(previous, scan)
  }

  return {
    async list() {
      return (await load()).workspaces.map(view)
    },

    add(rawPath, rawDepth = defaultWorkspaceDepth) {
      return enqueue(async () => {
        const parsedPath = pathInput.safeParse(rawPath)
        if (!parsedPath.success) {
          throw new DevhubError('INVALID_INPUT', '请提供工作区目录的绝对路径')
        }
        const depth = workspaceDepthSchema.safeParse(rawDepth)
        if (!depth.success) throw new DevhubError('INVALID_INPUT', '扫描层数应为 1～5')
        const path = resolve(parsedPath.data)

        const data = await load()
        const overlap = data.workspaces.find(
          (other) => isWithin(path, other.path, platform) || isWithin(other.path, path, platform)
        )
        if (overlap) {
          throw new DevhubError(
            'WORKSPACE_OVERLAP',
            `与已有工作区「${overlap.name}」重叠：${overlap.path}`
          )
        }
        await assertDirectory(path)

        const workspace: Workspace = {
          id: newId(),
          name: basename(path) || path,
          path,
          depth: depth.data,
          excluded: [],
          addedAt: now().toISOString()
        }
        data.workspaces.push(workspace)
        await store.write(data)
        await sync(workspace)
        emit({ type: 'projects-updated' })
        return view(workspace)
      })
    },

    update(rawId, rawPatch) {
      return enqueue(async () => {
        const data = await load()
        const workspace = find(data, rawId)
        const patch = workspacePatchSchema.safeParse(rawPatch)
        const excluded = absolutePaths.safeParse(patch.data?.excluded ?? [])
        if (!patch.success || !excluded.success) {
          throw new DevhubError('INVALID_INPUT', '工作区设置无效')
        }
        if (patch.data.depth !== undefined) workspace.depth = patch.data.depth
        if (patch.data.excluded !== undefined) {
          workspace.excluded = excluded.data.map((path) => resolve(path))
        }
        await store.write(data)
        await sync(workspace)
        emit({ type: 'projects-updated' })
        return view(workspace)
      })
    },

    remove(rawId) {
      return enqueue(async () => {
        const data = await load()
        const workspace = find(data, rawId)
        data.workspaces = data.workspaces.filter((other) => other.id !== workspace.id)
        await store.write(data)
        scans.delete(workspace.id)
        const owned = (await projects.list()).filter(
          (project) => project.workspaceId === workspace.id
        )
        const removed = await projects.removeMany(owned.map((project) => project.id))
        await forget(removed.map((project) => project.id))
        emit({ type: 'projects-updated' })
      })
    },

    rescanAll() {
      if (pendingRescan) return pendingRescan
      const rescan = enqueue(async () => {
        // From here on a new call must scan again: files may change while this one runs.
        pendingRescan = null
        const data = await load()
        let changed = false
        for (const workspace of data.workspaces) {
          if (await sync(workspace)) changed = true
        }
        if (changed) emit({ type: 'projects-updated' })
        return data.workspaces.map(view)
      })
      pendingRescan = rescan
      return rescan
    },

    removeProject(rawId) {
      return enqueue(async () => {
        const project = await projects.get(rawId)
        const data = await load()
        const workspace = data.workspaces.find((candidate) =>
          project.workspaceId
            ? candidate.id === project.workspaceId
            : isWithin(project.path, candidate.path, platform)
        )
        if (
          workspace &&
          !workspace.excluded.some((path) => samePath(path, project.path, platform))
        ) {
          workspace.excluded.push(project.path)
          await store.write(data)
        }
        await projects.remove(project.id)
        await deps.forgetProject(project.id)
        if (workspace) emit({ type: 'projects-updated' })
      })
    },

    async flush() {
      await queue
    }
  }
}

function toScanState(result: ScanResult, at: Date): WorkspaceScan {
  const scannedAt = at.toISOString()
  return result.status === 'ok'
    ? { scannedAt, available: true, complete: result.complete, warnings: result.warnings }
    : { scannedAt, available: false, complete: false, warnings: [`无法扫描：${result.reason}`] }
}

function sameOutcome(a: WorkspaceScan | undefined, b: WorkspaceScan): boolean {
  return (
    a !== undefined &&
    a.available === b.available &&
    a.complete === b.complete &&
    a.warnings.join('\n') === b.warnings.join('\n')
  )
}
