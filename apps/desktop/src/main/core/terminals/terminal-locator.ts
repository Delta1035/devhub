import { createFinder, type Candidate, type FinderDeps } from '../fs/finder'

/** A terminal application found on this machine, and how to open it in a directory. */
export interface SystemTerminal {
  name: string
  path: string
  /** Arguments that open a window in `dir`; the process also starts with `dir` as cwd. */
  args: (dir: string) => string[]
}

export interface TerminalLocator {
  locate(): Promise<SystemTerminal | null>
}

interface Definition {
  name: string
  candidates: Candidate[]
  args: (dir: string) => string[]
}

const inCwd = (): string[] => []
const workingDirectory = (dir: string): string[] => [`--working-directory=${dir}`]

/** First installed terminal in order of preference; Windows and Linux only. */
export function createTerminalLocator(deps: FinderDeps): TerminalLocator {
  const { env } = deps
  const { path, isWindows, file, onPath, first } = createFinder(deps)
  const systemRoot = env.SystemRoot ?? env.windir

  const definitions: Definition[] = isWindows
    ? [
        {
          name: 'Windows Terminal',
          candidates: [
            onPath('wt.exe'),
            file(
              env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'wt.exe')
            )
          ],
          // wt reads `;` as a separator between its own commands; `\;` is a literal one.
          args: (dir) => ['-d', dir.replaceAll(';', '\\;')]
        },
        // A console program started detached gets its own console window.
        { name: 'PowerShell 7', candidates: [onPath('pwsh.exe')], args: () => ['-NoLogo'] },
        {
          name: 'Windows PowerShell',
          candidates: [
            file(
              systemRoot &&
                path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
            ),
            onPath('powershell.exe')
          ],
          args: () => ['-NoLogo']
        },
        { name: '命令提示符', candidates: [file(env.ComSpec), onPath('cmd.exe')], args: inCwd }
      ]
    : deps.platform === 'linux'
      ? [
          // The distribution's choice of default terminal (Debian / Ubuntu / Mint alternatives).
          { name: '默认终端', candidates: [onPath('x-terminal-emulator')], args: inCwd },
          {
            name: 'GNOME Terminal',
            candidates: [onPath('gnome-terminal')],
            args: workingDirectory
          },
          { name: 'Konsole', candidates: [onPath('konsole')], args: (dir) => ['--workdir', dir] },
          { name: 'Xfce Terminal', candidates: [onPath('xfce4-terminal')], args: workingDirectory },
          { name: 'MATE Terminal', candidates: [onPath('mate-terminal')], args: workingDirectory },
          { name: 'Tilix', candidates: [onPath('tilix')], args: workingDirectory },
          { name: 'kitty', candidates: [onPath('kitty')], args: (dir) => ['--directory', dir] },
          {
            name: 'Alacritty',
            candidates: [onPath('alacritty')],
            args: (dir) => ['--working-directory', dir]
          },
          { name: 'xterm', candidates: [onPath('xterm')], args: inCwd }
        ]
      : []

  return {
    async locate() {
      for (const definition of definitions) {
        const found = await first(definition.candidates)
        if (found) return { name: definition.name, path: found, args: definition.args }
      }
      return null
    }
  }
}
