import { DevhubError, editorIdSchema, type EditorId, type EditorInfo } from '@devhub/shared'
import { isDirectory } from '../fs/is-directory'
import type { ProjectService } from '../projects/project-service'
import { buildLaunchSpec, type LaunchSpec } from './editor-launch'
import type { EditorLauncher, EditorLocator } from './editor-locator'

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
  /** The environment for the editor process; read at every launch (ADR 0024). */
  resolveEnv: () => Promise<NodeJS.ProcessEnv>
  platform: NodeJS.Platform
  /** The user's chosen executable from settings, or null to auto-detect. */
  customPath: (editor: EditorId) => Promise<string | null>
  isFile: (path: string) => Promise<boolean>
}

export function createEditorService({
  projects,
  locator,
  launch,
  resolveEnv,
  platform,
  customPath,
  isFile
}: EditorServiceDeps): EditorService {
  /** A configured path wins while the file exists; otherwise auto-detection takes over. */
  const resolve = async (
    editor: EditorId
  ): Promise<{ launcher: EditorLauncher; custom: boolean } | null> => {
    const path = await customPath(editor)
    if (path && (await isFile(path))) {
      const batch = platform === 'win32' && /\.(cmd|bat)$/i.test(path)
      return { launcher: { kind: batch ? 'batch' : 'executable', path }, custom: true }
    }
    const launcher = await locator.locate(editor)
    return launcher ? { launcher, custom: false } : null
  }

  return {
    async list() {
      return Promise.all(
        editorIdSchema.options.map(async (id) => {
          const found = await resolve(id)
          return {
            id,
            name: editorNames[id],
            available: found !== null,
            path: found?.launcher.path ?? null,
            custom: found?.custom ?? false
          }
        })
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
      const found = await resolve(editor.data)
      if (!found) throw new DevhubError('EDITOR_NOT_FOUND', `未检测到 ${name}`)
      const { launcher } = found
      const env = await resolveEnv()

      try {
        await launch(buildLaunchSpec(launcher, project.path, env), project.path)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new DevhubError('EDITOR_LAUNCH_FAILED', `无法启动 ${name}：${detail}`)
      }
    }
  }
}
