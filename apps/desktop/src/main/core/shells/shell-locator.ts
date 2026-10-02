import type { ShellId } from '@devhub/shared'
import { createFinder, type Candidate, type FinderDeps } from '../fs/finder'

/** An installed shell and how to start it interactively. */
export interface ShellSpec {
  id: ShellId
  name: string
  file: string
  args: string[]
  /** Extra environment variables for this shell. */
  env: Record<string, string>
  /** A file the shell reads at startup; written by `prepare` before each launch. */
  startupFile?: { path: string; content: string }
}

export interface ShellLocatorDeps extends FinderDeps {
  /** Output of `reg query <key> /s`, or '' when the key does not exist. Windows only. */
  queryRegistry: (key: string) => Promise<string>
  /** DevHub-owned directory for shell startup files. */
  startupDir: string
  writeFile: (path: string, content: string) => Promise<void>
}

export interface ShellLocator {
  /** Installed shells in preference order; the first one is the default. */
  list(): Promise<ShellSpec[]>
  /** Writes the shell's startup file, if it has one. Call right before launching it. */
  prepare(shell: ShellSpec): Promise<void>
}

/**
 * Startup file for Git Bash. It reads the same files a login shell would, in the same order,
 * then drops Git for Windows' `winpty` aliases (node, python…). Those exist for mintty, which
 * has no Win32 console; under ConPTY there is one, and the winpty wrapper's parent exits, which
 * cuts the program out of the process tree so closing the terminal could not stop it.
 */
export const gitBashStartup = `# Written by DevHub on every launch; edits are overwritten.
[ -f /etc/profile ] && . /etc/profile
if [ -f ~/.bash_profile ]; then . ~/.bash_profile
elif [ -f ~/.bash_login ]; then . ~/.bash_login
elif [ -f ~/.profile ]; then . ~/.profile
fi
for name in node ipython php php5 psql python2.7 winget; do
  case "$(alias "$name" 2>/dev/null)" in *"='winpty "*) unalias "$name" ;; esac
done
unset name
`

interface ShellDefinition {
  id: ShellId
  name: string
  candidates: Candidate[]
  args: string[]
  env?: Record<string, string>
  startupFile?: { path: string; content: string }
}

export function createShellLocator(deps: ShellLocatorDeps): ShellLocator {
  const { env, queryRegistry, startupDir, writeFile } = deps
  const { path, isWindows, file, onPath, first } = createFinder(deps)

  const gitBash = (root: string): string => path.join(root, 'bin', 'bash.exe')

  /** Git for Windows records its install directory, wherever the user put it. */
  const gitBashFromRegistry: Candidate = async () => {
    for (const root of ['HKCU', 'HKLM']) {
      const output = await queryRegistry(`${root}\\SOFTWARE\\GitForWindows`)
      const installPath = /^\s+InstallPath\s+REG_SZ\s+(.+?)\s*$/m.exec(output)?.[1]
      const found = await file(installPath && gitBash(installPath))()
      if (found) return found
    }
    return null
  }

  /**
   * Derives Git Bash from git.exe on PATH (`<root>\cmd\git.exe` or `<root>\mingw64\bin\…`).
   * PATH's own `bash` is not used: on Windows it is often WSL's System32\bash.exe.
   */
  const gitBashFromGitOnPath: Candidate = async () => {
    const git = await onPath('git.exe')()
    if (!git) return null
    const parent = path.dirname(path.dirname(git))
    return first([file(gitBash(parent)), file(gitBash(path.dirname(parent)))])
  }

  const programFiles = env.ProgramFiles
  const localAppData = env.LOCALAPPDATA
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'

  // bash (MSYS) accepts Windows paths with forward slashes.
  const gitBashRcFile = path.join(startupDir, 'git-bash.rc')
  const gitBashRcArg = gitBashRcFile.split(path.sep).join('/')

  const loginShell = (id: ShellId, paths: string[]): ShellDefinition => ({
    id,
    name: id,
    candidates: paths.map((shellPath) => file(shellPath)),
    args: ['-l']
  })

  // Preference order: bash first (the user's choice), alternatives after it.
  const definitions: ShellDefinition[] = isWindows
    ? [
        {
          id: 'git-bash',
          name: 'Git Bash',
          candidates: [
            gitBashFromRegistry,
            gitBashFromGitOnPath,
            file(programFiles && gitBash(path.join(programFiles, 'Git'))),
            file(localAppData && gitBash(path.join(localAppData, 'Programs', 'Git')))
          ],
          // Long options must come before -i.
          args: ['--rcfile', gitBashRcArg, '-i'],
          // Otherwise /etc/profile changes to $HOME instead of staying in the project.
          env: { CHERE_INVOKING: '1' },
          startupFile: { path: gitBashRcFile, content: gitBashStartup }
        },
        {
          id: 'pwsh',
          name: 'PowerShell 7',
          candidates: [
            onPath('pwsh.exe'),
            file(programFiles && path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'))
          ],
          args: ['-NoLogo']
        },
        {
          id: 'powershell',
          name: 'Windows PowerShell',
          candidates: [
            file(path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')),
            onPath('powershell.exe')
          ],
          args: ['-NoLogo']
        },
        {
          id: 'cmd',
          name: '命令提示符 (cmd)',
          candidates: [file(env.ComSpec), file(path.join(systemRoot, 'System32', 'cmd.exe'))],
          args: []
        }
      ]
    : [
        loginShell('bash', ['/bin/bash', '/usr/bin/bash']),
        loginShell('zsh', ['/bin/zsh', '/usr/bin/zsh']),
        loginShell('fish', ['/usr/bin/fish', '/bin/fish']),
        loginShell('sh', ['/bin/sh'])
      ]

  return {
    async list() {
      const found = await Promise.all(
        definitions.map(async (shell) => {
          const shellPath = await first(shell.candidates)
          return shellPath
            ? {
                id: shell.id,
                name: shell.name,
                file: shellPath,
                args: shell.args,
                env: shell.env ?? {},
                ...(shell.startupFile ? { startupFile: shell.startupFile } : {})
              }
            : null
        })
      )
      return found.filter((shell) => shell !== null)
    },

    async prepare(shell) {
      if (shell.startupFile) await writeFile(shell.startupFile.path, shell.startupFile.content)
    }
  }
}
