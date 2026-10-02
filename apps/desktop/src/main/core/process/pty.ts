import { spawn as spawnNodePty } from 'node-pty'

/** The subset of a pseudo-terminal process DevHub relies on; faked in unit tests. */
export interface PtyProcess {
  readonly pid: number
  onData(listener: (data: string) => void): void
  onExit(listener: (exitCode: number) => void): void
  write(data: string): void
  resize(cols: number, rows: number): void
}

export interface PtySpawnOptions {
  /** Shell command line, e.g. `pnpm run dev`. */
  command: string
  cwd: string
  env: Record<string, string>
  platform: NodeJS.Platform
}

export type PtySpawner = (options: PtySpawnOptions) => PtyProcess

export interface ShellInvocation {
  file: string
  /** A string is passed to Windows verbatim as the command line (no re-quoting). */
  args: string | string[]
}

/**
 * Runs the command through the platform shell so `.cmd` shims and PATH lookup work.
 * Linux uses a login shell: GUI-launched apps often lack PATH entries from the profile
 * (nvm, sdkman…).
 */
export function shellInvocation(
  command: string,
  platform: NodeJS.Platform,
  env: Record<string, string>
): ShellInvocation {
  if (platform === 'win32') {
    // /s strips the outer quotes, so the command keeps its own quoting intact. Passed as a
    // string because node-pty would otherwise escape inner quotes with backslashes, which
    // cmd.exe does not understand.
    return { file: env.ComSpec ?? 'cmd.exe', args: `/d /s /c "${command}"` }
  }
  return { file: env.SHELL || '/bin/sh', args: ['-lc', command] }
}

const defaultSize = { cols: 120, rows: 30 }

export const nodePtySpawner: PtySpawner = ({ command, cwd, env, platform }) => {
  const { file, args } = shellInvocation(command, platform, env)
  const pty = spawnNodePty(file, args, { name: 'xterm-256color', cwd, env, ...defaultSize })

  if (platform === 'win32') {
    // On Windows node-pty keeps a conout worker thread alive after the process exits until
    // kill() is called; without this every finished run would leak a thread.
    pty.onExit(() => {
      setImmediate(() => {
        try {
          pty.kill()
        } catch {
          // Already released.
        }
      })
    })
  }

  return {
    pid: pty.pid,
    onData: (listener) => void pty.onData(listener),
    onExit: (listener) => void pty.onExit(({ exitCode }) => listener(exitCode)),
    write: (data) => pty.write(data),
    resize: (cols, rows) => pty.resize(cols, rows)
  }
}
