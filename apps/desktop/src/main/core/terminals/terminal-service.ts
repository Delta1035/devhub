import { DevhubError, type SystemTerminalInfo } from '@devhub/shared'
import { launchEnv, type LaunchSpec } from '../editors/editor-launch'
import { isDirectory } from '../fs/is-directory'
import type { ProjectService } from '../projects/project-service'
import type { TerminalLocator } from './terminal-locator'

export interface SystemTerminalService {
  get(): Promise<SystemTerminalInfo | null>
  open(projectId: unknown): Promise<void>
}

export interface SystemTerminalServiceDeps {
  projects: Pick<ProjectService, 'get'>
  locator: TerminalLocator
  launch: (spec: LaunchSpec, cwd: string) => Promise<void>
  env: NodeJS.ProcessEnv
}

/**
 * Opens a terminal window of the OS in a project directory. Like editors, it is a detached
 * process DevHub does not manage: it is not a run and outlives DevHub.
 */
export function createSystemTerminalService({
  projects,
  locator,
  launch,
  env
}: SystemTerminalServiceDeps): SystemTerminalService {
  return {
    async get() {
      const terminal = await locator.locate()
      return terminal && { name: terminal.name, path: terminal.path }
    },

    async open(projectId) {
      // The path comes from the registry, never from the caller.
      const project = await projects.get(projectId)
      if (!(await isDirectory(project.path))) {
        throw new DevhubError('PROJECT_PATH_NOT_FOUND', `目录不存在：${project.path}`)
      }
      const terminal = await locator.locate()
      if (!terminal) throw new DevhubError('TERMINAL_NOT_FOUND', '未检测到系统终端')

      try {
        await launch(
          {
            file: terminal.path,
            args: terminal.args(project.path),
            windowsVerbatimArguments: false,
            // A console program needs its window; that is the whole point here.
            windowsHide: false,
            env: launchEnv(env)
          },
          project.path
        )
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new DevhubError('TERMINAL_LAUNCH_FAILED', `无法启动 ${terminal.name}：${detail}`)
      }
    }
  }
}
