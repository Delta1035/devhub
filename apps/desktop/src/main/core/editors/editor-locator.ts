import { posix, win32 } from 'path'
import type { EditorId } from '@devhub/shared'
import { parseJetBrainsInstallDirs } from './windows-registry'

/** How to start an editor: an executable directly, or a Windows `.cmd`/`.bat` through cmd. */
export interface EditorLauncher {
  kind: 'executable' | 'batch'
  path: string
}

export interface EditorLocatorDeps {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  exists: (path: string) => Promise<boolean>
  /** Directory entries, or [] when the directory does not exist. */
  listDir: (path: string) => Promise<string[]>
  /** Output of `reg query <key> /s`, or '' when the key does not exist. Windows only. */
  queryRegistry: (key: string) => Promise<string>
}

export interface EditorLocator {
  locate(editor: EditorId): Promise<EditorLauncher | null>
}

/** A lazily evaluated candidate; the first one that resolves to a launcher wins. */
type Candidate = () => Promise<EditorLauncher | null>

export function createEditorLocator(deps: EditorLocatorDeps): EditorLocator {
  const { platform, env, exists, listDir, queryRegistry } = deps
  const isWindows = platform === 'win32'
  // Platform-specific path rules, so Windows lookups are testable on Linux and vice versa.
  const path = isWindows ? win32 : posix

  const launcherFor = (file: string): EditorLauncher => ({
    kind: isWindows && /\.(cmd|bat)$/i.test(file) ? 'batch' : 'executable',
    path: file
  })

  const file =
    (candidatePath: string | undefined): Candidate =>
    async () =>
      candidatePath && (await exists(candidatePath)) ? launcherFor(candidatePath) : null

  /** Like `which`: searches PATH, trying PATHEXT extensions on Windows. */
  const onPath =
    (name: string): Candidate =>
    async () => {
      const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
      const extensions = isWindows
        ? path.extname(name)
          ? ['']
          : (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((ext) => ext.toLowerCase())
        : ['']
      for (const dir of dirs) {
        for (const ext of extensions) {
          const candidatePath = path.join(dir, name + ext)
          if (await exists(candidatePath)) return launcherFor(candidatePath)
        }
      }
      return null
    }

  /** Newest `<parent>/<prefix>*` directory containing `relative`. */
  const versionedDir =
    (parent: string | undefined, prefix: string, relative: string): Candidate =>
    async () => {
      if (!parent) return null
      const dirs = (await listDir(parent)).filter((entry) => entry.startsWith(prefix))
      for (const dir of dirs.sort().reverse()) {
        const found = await file(path.join(parent, dir, relative))()
        if (found) return found
      }
      return null
    }

  const jetBrainsRegistry =
    (prefix: string): Candidate =>
    async () => {
      for (const root of ['HKCU', 'HKLM']) {
        const dirs = parseJetBrainsInstallDirs(
          await queryRegistry(`${root}\\SOFTWARE\\JetBrains`),
          prefix
        )
        for (const dir of dirs) {
          const found = await file(path.join(dir, 'bin', 'idea64.exe'))()
          if (found) return found
        }
      }
      return null
    }

  /** The `code` CLI is a batch file; prefer the Code.exe next to it to avoid a console. */
  const vscodeFromPath: Candidate = async () => {
    const cli = await onPath('code')()
    if (!cli || !isWindows) return cli
    const exe = path.join(path.dirname(path.dirname(cli.path)), 'Code.exe')
    return (await exists(exe)) ? launcherFor(exe) : cli
  }

  const localAppData = env.LOCALAPPDATA
  const programFiles = env.ProgramFiles
  const home = env.HOME

  const candidates: Record<EditorId, Candidate[]> = isWindows
    ? {
        vscode: [
          vscodeFromPath,
          file(
            localAppData && path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe')
          ),
          file(programFiles && path.join(programFiles, 'Microsoft VS Code', 'Code.exe'))
        ],
        idea: [
          onPath('idea64.exe'),
          onPath('idea'),
          jetBrainsRegistry('IntelliJ IDEA'),
          file(
            localAppData && path.join(localAppData, 'JetBrains', 'Toolbox', 'scripts', 'idea.cmd')
          ),
          versionedDir(
            localAppData && path.join(localAppData, 'Programs'),
            'IntelliJ IDEA',
            path.join('bin', 'idea64.exe')
          ),
          versionedDir(
            programFiles && path.join(programFiles, 'JetBrains'),
            'IntelliJ IDEA',
            path.join('bin', 'idea64.exe')
          )
        ]
      }
    : {
        vscode: [vscodeFromPath, file('/snap/bin/code')],
        idea: [
          onPath('idea'),
          onPath('idea.sh'),
          onPath('intellij-idea-ultimate'),
          onPath('intellij-idea-community'),
          file(
            home && path.join(home, '.local', 'share', 'JetBrains', 'Toolbox', 'scripts', 'idea')
          ),
          file('/snap/bin/intellij-idea-ultimate'),
          file('/snap/bin/intellij-idea-community')
        ]
      }

  return {
    async locate(editor) {
      for (const candidate of candidates[editor]) {
        const found = await candidate()
        if (found) return found
      }
      return null
    }
  }
}
