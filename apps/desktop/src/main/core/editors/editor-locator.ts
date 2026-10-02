import type { EditorId } from '@devhub/shared'
import { createFinder, type Candidate, type FinderDeps } from '../fs/finder'
import { parseJetBrainsInstallDirs } from './windows-registry'

/** How to start an editor: an executable directly, or a Windows `.cmd`/`.bat` through cmd. */
export interface EditorLauncher {
  kind: 'executable' | 'batch'
  path: string
}

export interface EditorLocatorDeps extends FinderDeps {
  /** Output of `reg query <key> /s`, or '' when the key does not exist. Windows only. */
  queryRegistry: (key: string) => Promise<string>
}

export interface EditorLocator {
  locate(editor: EditorId): Promise<EditorLauncher | null>
}

export function createEditorLocator(deps: EditorLocatorDeps): EditorLocator {
  const { env, exists, queryRegistry } = deps
  const { path, isWindows, file, onPath, versionedDir, first } = createFinder(deps)

  const jetBrainsRegistry =
    (prefix: string): Candidate =>
    async () => {
      for (const root of ['HKCU', 'HKLM']) {
        const output = await queryRegistry(`${root}\\SOFTWARE\\JetBrains`)
        for (const dir of parseJetBrainsInstallDirs(output, prefix)) {
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
    const exe = path.join(path.dirname(path.dirname(cli)), 'Code.exe')
    return (await exists(exe)) ? exe : cli
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
      const found = await first(candidates[editor])
      if (!found) return null
      return {
        kind: isWindows && /\.(cmd|bat)$/i.test(found) ? 'batch' : 'executable',
        path: found
      }
    }
  }
}
