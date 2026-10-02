import { DevhubError, editorIdSchema, type EditorId, type EditorInfo } from '@devhub/shared'
import { isDirectory } from '../fs/is-directory'
import type { ProjectService } from '../projects/project-service'
import { buildLaunchSpec, type LaunchSpec } from './editor-launch'
import type { EditorLocator } from './editor-locator'

const editorNames: Record<EditorId, string> = {
  vscode: 'VS Code',
  idea: 'IntelliJ IDEA'
}

export interface EditorService {
  list(): Promise<EditorInfo[]>
  open(projectId: unknown, editor: unknown): Promise<void>
}

export interface EditorServiceDeps {
  projects: Pick<ProjectService, 'get'>
  locator: EditorLocator
  launch: (spec: LaunchSpec, cwd: string) => Promise<void>
  env: NodeJS.ProcessEnv
}

export function createEditorService({
  projects,
  locator,
  launch,
  env
}: EditorServiceDeps): EditorService {
  return {
    async list() {
      return Promise.all(
        editorIdSchema.options.map(async (id) => ({
          id,
          name: editorNames[id],
          available: (await locator.locate(id)) !== null
        }))
      )
    },

    async open(projectId, rawEditor) {
      const editor = editorIdSchema.safeParse(rawEditor)
      if (!editor.success) throw new DevhubError('INVALID_INPUT', '不支持的编辑器')
      // The path comes from the registry, never from the caller.
      const project = await projects.get(projectId)
      if (!(await isDirectory(project.path))) {
        throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${project.path}`)
      }

      const name = editorNames[editor.data]
      const launcher = await locator.locate(editor.data)
      if (!launcher) throw new DevhubError('EDITOR_NOT_FOUND', `未检测到 ${name}`)

      try {
        await launch(buildLaunchSpec(launcher, project.path, env), project.path)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new DevhubError('EDITOR_LAUNCH_FAILED', `无法启动 ${name}：${detail}`)
      }
    }
  }
}
