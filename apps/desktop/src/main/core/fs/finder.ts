import { posix, win32 } from 'path'

/** A lazily evaluated lookup; resolves to an absolute file path or null. */
export type Candidate = () => Promise<string | null>

export interface FinderDeps {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  exists: (path: string) => Promise<boolean>
  /** Directory entries, or [] when the directory does not exist. */
  listDir: (path: string) => Promise<string[]>
}

export interface Finder {
  /** `path.win32` or `path.posix`, so lookups for either platform are testable anywhere. */
  path: typeof win32
  isWindows: boolean
  /** The given path, if it exists. Undefined paths (unset env vars) never match. */
  file(candidatePath: string | undefined): Candidate
  /** Like `which`: searches PATH, trying PATHEXT extensions on Windows. */
  onPath(name: string): Candidate
  /** Newest `<parent>/<prefix>*` directory containing `relative`. */
  versionedDir(parent: string | undefined, prefix: string, relative: string): Candidate
  /** The first candidate that resolves, in order. */
  first(candidates: Candidate[]): Promise<string | null>
}

/** Shared lookup primitives for locating installed programs (editors, shells). */
export function createFinder({ platform, env, exists, listDir }: FinderDeps): Finder {
  const isWindows = platform === 'win32'
  const path = isWindows ? win32 : posix

  const file =
    (candidatePath: string | undefined): Candidate =>
    async () =>
      candidatePath && (await exists(candidatePath)) ? candidatePath : null

  const onPath =
    (name: string): Candidate =>
    async () => {
      const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean)
      const extensions =
        isWindows && !path.extname(name)
          ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((ext) => ext.toLowerCase())
          : ['']
      for (const dir of dirs) {
        for (const ext of extensions) {
          const found = await file(path.join(dir, name + ext))()
          if (found) return found
        }
      }
      return null
    }

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

  const first = async (candidates: Candidate[]): Promise<string | null> => {
    for (const candidate of candidates) {
      const found = await candidate()
      if (found) return found
    }
    return null
  }

  return { path, isWindows, file, onPath, versionedDir, first }
}
