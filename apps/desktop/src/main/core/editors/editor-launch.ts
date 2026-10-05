import { spawn } from 'child_process'
import type { EditorLauncher } from './editor-locator'

export interface LaunchSpec {
  file: string
  args: string[]
  /** Pass args to Windows untouched (needed for cmd's own quoting rules). */
  windowsVerbatimArguments: boolean
  /** Hide the console window; only for batch launchers, never for GUI executables. */
  windowsHide: boolean
  env: Record<string, string>
}

/** Builds the process to start for opening `dir`. Pure, so both platforms are unit-tested. */
export function buildLaunchSpec(
  launcher: EditorLauncher,
  dir: string,
  env: NodeJS.ProcessEnv
): LaunchSpec {
  const cleanEnv = launchEnv(env)
  if (launcher.kind === 'batch') {
    // cmd /s strips the outer quotes, leaving `"<launcher>" "<dir>"`. Windows paths cannot
    // contain double quotes, so quoting each part is enough.
    return {
      file: cleanEnv.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', `""${launcher.path}" "${dir}""`],
      windowsVerbatimArguments: true,
      windowsHide: true,
      env: cleanEnv
    }
  }
  return {
    file: launcher.path,
    args: [dir],
    windowsVerbatimArguments: false,
    windowsHide: false,
    env: cleanEnv
  }
}

/**
 * Inherited from DevHub's own environment, but `ELECTRON_RUN_AS_NODE` (set when DevHub runs
 * from a VS Code terminal) would make VS Code, itself an Electron app, start as plain Node.
 * Also used for system terminals, so tools started from them behave the same.
 */
export function launchEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') result[key] = value
  }
  return result
}

/** Starts the editor detached so it outlives DevHub; resolves once the process started. */
export function launchDetached(spec: LaunchSpec, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.file, spec.args, {
      cwd,
      env: spec.env,
      detached: true,
      stdio: 'ignore',
      windowsHide: spec.windowsHide,
      windowsVerbatimArguments: spec.windowsVerbatimArguments
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
