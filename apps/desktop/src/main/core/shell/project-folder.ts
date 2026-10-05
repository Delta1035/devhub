import { z } from 'zod'
import { DevhubError, type Project } from '@devhub/shared'

const idInput = z.string().min(1).max(200)

export interface ProjectFolderDeps {
  listProjects: () => Promise<Project[]>
  isDirectory: (path: string) => Promise<boolean>
}

/**
 * Directory of a registered project, to show in the system file manager. The caller only sends
 * an id: handing an arbitrary path to the OS could open (run) a file instead of a folder.
 */
export async function resolveProjectFolder(
  rawId: unknown,
  { listProjects, isDirectory }: ProjectFolderDeps
): Promise<string> {
  const parsed = idInput.safeParse(rawId)
  const project = parsed.success
    ? (await listProjects()).find((candidate) => candidate.id === parsed.data)
    : undefined
  if (!project) throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
  if (!(await isDirectory(project.path))) {
    throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${project.path}`)
  }
  return project.path
}
