import { randomUUID } from 'crypto'
import { stat } from 'fs/promises'
import { basename, isAbsolute, resolve } from 'path'
import { z } from 'zod'
import { DevhubError, projectSchema, type Project } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

export const projectsFileSchema = z.object({
  version: z.literal(1),
  projects: z.array(projectSchema)
})
export type ProjectsFile = z.infer<typeof projectsFileSchema>

export const emptyProjectsFile = (): ProjectsFile => ({ version: 1, projects: [] })

export interface ProjectService {
  list(): Promise<Project[]>
  add(path: unknown): Promise<Project>
  remove(projectId: unknown): Promise<void>
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

  // Windows paths are case-insensitive: C:\Repo and c:\repo are the same project.
  const samePath = (a: string, b: string): boolean =>
    platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b

  return {
    async list() {
      const data = await load()
      return [...data.projects]
    },

    add(rawPath) {
      return mutate(async (data) => {
        const parsed = pathInput.safeParse(rawPath)
        if (!parsed.success || !isAbsolute(parsed.data)) {
          throw new DevhubError('INVALID_INPUT', '请提供项目目录的绝对路径')
        }
        const path = resolve(parsed.data)

        const existing = data.projects.find((project) => samePath(project.path, path))
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
    }
  }
}

async function assertDirectory(path: string): Promise<void> {
  try {
    const stats = await stat(path)
    if (!stats.isDirectory()) {
      throw new DevhubError('PROJECT_PATH_NOT_DIRECTORY', `不是一个目录：${path}`)
    }
  } catch (error) {
    if (error instanceof DevhubError) throw error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${path}`)
    }
    throw error
  }
}
