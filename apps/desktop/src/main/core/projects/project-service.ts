import { randomUUID } from 'crypto'
import { basename, isAbsolute, resolve } from 'path'
import { z } from 'zod'
import { DevhubError, projectSchema, type Project } from '@devhub/shared'
import { assertDirectory } from '../fs/assert-directory'
import { samePath } from '../fs/path-compare'
import type { JsonStore } from '../storage/json-store'

export const projectsFileSchema = z.object({
  version: z.literal(1),
  projects: z.array(projectSchema)
})
export type ProjectsFile = z.infer<typeof projectsFileSchema>

export const emptyProjectsFile = (): ProjectsFile => ({ version: 1, projects: [] })

export interface ProjectService {
  list(): Promise<Project[]>
  /** Throws PROJECT_NOT_FOUND for unknown or malformed ids. */
  get(projectId: unknown): Promise<Project>
  add(path: unknown): Promise<Project>
  remove(projectId: unknown): Promise<void>
  /**
   * Adds discovered directories in one write. Trusted input (normalized absolute paths from a
   * scan); paths that are already projects are skipped, not reported.
   */
  addDiscovered(paths: string[], workspaceId: string): Promise<Project[]>
  /** Removes several projects in one write; unknown ids are ignored. Returns the removed ones. */
  removeMany(projectIds: string[]): Promise<Project[]>
}

export interface ProjectServiceDeps {
  store: JsonStore<ProjectsFile>
  platform: NodeJS.Platform
  now?: () => Date
  newId?: () => string
}

const pathInput = z.string().trim().min(1)
const idInput = z.string().min(1)

export function createProjectService({
  store,
  platform,
  now = () => new Date(),
  newId = randomUUID
}: ProjectServiceDeps): ProjectService {
  let cache: ProjectsFile | null = null
  // Serializes read-modify-write cycles so concurrent calls cannot lose updates.
  let queue: Promise<unknown> = Promise.resolve()

  const load = async (): Promise<ProjectsFile> => (cache ??= await store.read())

  const mutate = <T>(fn: (data: ProjectsFile) => Promise<T>): Promise<T> => {
    const next = queue.then(async () => {
      const data = await load()
      const result = await fn(data)
      await store.write(data)
      return result
    })
    queue = next.catch(() => undefined)
    return next
  }

  const findByPath = (data: ProjectsFile, path: string): Project | undefined =>
    data.projects.find((project) => samePath(project.path, path, platform))

  return {
    async list() {
      const data = await load()
      return [...data.projects]
    },

    async get(rawId) {
      const data = await load()
      const parsed = idInput.safeParse(rawId)
      const project = parsed.success
        ? data.projects.find((candidate) => candidate.id === parsed.data)
        : undefined
      if (!project) throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
      return project
    },

    add(rawPath) {
      return mutate(async (data) => {
        const parsed = pathInput.safeParse(rawPath)
        if (!parsed.success || !isAbsolute(parsed.data)) {
          throw new DevhubError('INVALID_INPUT', '请提供项目目录的绝对路径')
        }
        const path = resolve(parsed.data)

        const existing = findByPath(data, path)
        if (existing) {
          throw new DevhubError('PROJECT_ALREADY_ADDED', `项目已存在：${existing.name}`)
        }
        await assertDirectory(path)

        const project: Project = {
          id: newId(),
          name: basename(path) || path,
          path,
          addedAt: now().toISOString()
        }
        data.projects.push(project)
        return project
      })
    },

    remove(rawId) {
      return mutate(async (data) => {
        const parsed = idInput.safeParse(rawId)
        const index = parsed.success
          ? data.projects.findIndex((project) => project.id === parsed.data)
          : -1
        if (index === -1) throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
        data.projects.splice(index, 1)
      })
    },

    addDiscovered(paths, workspaceId) {
      return mutate(async (data) => {
        const added: Project[] = []
        for (const path of paths) {
          if (findByPath(data, path)) continue
          const project: Project = {
            id: newId(),
            name: basename(path) || path,
            path,
            addedAt: now().toISOString(),
            workspaceId
          }
          data.projects.push(project)
          added.push(project)
        }
        return added
      })
    },

    removeMany(projectIds) {
      return mutate(async (data) => {
        const ids = new Set(projectIds)
        const removed = data.projects.filter((project) => ids.has(project.id))
        data.projects = data.projects.filter((project) => !ids.has(project.id))
        return removed
      })
    }
  }
}
