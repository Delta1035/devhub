import { readdir } from 'fs/promises'
import { join } from 'path'
import { configFileNames } from '../detectors/config-detector'

/** The parts of a directory entry the scanner needs; `fs.Dirent` satisfies it. */
export interface DirEntry {
  name: string
  isFile(): boolean
  isDirectory(): boolean
  /** Also true for Windows junctions, which are followed no more than symlinks. */
  isSymbolicLink(): boolean
}

export type ReadDir = (path: string) => Promise<DirEntry[]>

export interface ScanOptions {
  /** Levels below the root to search: 1 means only its direct children. */
  depth: number
  /** Upper bound on directories read, so picking a whole drive cannot scan forever. */
  maxDirectories?: number
  readDir?: ReadDir
}

export type ScanResult =
  | {
      status: 'ok'
      /** Absolute project paths, in a stable (name-sorted, depth-first) order. */
      projects: string[]
      /**
       * False when part of the tree could not be read or the limit was hit: projects missing
       * from `projects` may still exist, so callers must not treat them as gone.
       */
      complete: boolean
      warnings: string[]
    }
  /** The root itself is missing or unreadable; nothing is known about its projects. */
  | { status: 'unavailable'; reason: string }

/** Files that make a directory a project: the build files the script detectors read. */
export const projectMarkers: ReadonlySet<string> = new Set([
  'package.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  ...configFileNames
])

/** Dependency, build output and system directories that never contain the user's projects. */
const skippedDirectories: ReadonlySet<string> = new Set([
  'node_modules',
  'target',
  'build',
  'dist',
  'out',
  'vendor',
  '$recycle.bin',
  'system volume information'
])

export const defaultMaxDirectories = 5000

const defaultReadDir: ReadDir = (path) => readdir(path, { withFileTypes: true })

/**
 * Finds projects under a workspace root. A directory with a project marker is a project and is
 * not searched further (its modules belong to it); the root itself is never a project.
 * Symlinks and junctions are not followed, which also rules out cycles.
 */
export async function scanWorkspace(root: string, options: ScanOptions): Promise<ScanResult> {
  const { depth, maxDirectories = defaultMaxDirectories, readDir = defaultReadDir } = options

  let rootEntries: DirEntry[]
  try {
    rootEntries = await readDir(root)
  } catch (error) {
    return { status: 'unavailable', reason: describeError(error) }
  }

  const projects: string[] = []
  const warnings: string[] = []
  let read = 1
  let complete = true
  let limitHit = false

  const visit = async (entries: DirEntry[], dir: string, level: number): Promise<void> => {
    for (const entry of sortedSubdirectories(entries)) {
      if (read >= maxDirectories) {
        limitHit = true
        complete = false
        return
      }
      const path = join(dir, entry.name)
      let children: DirEntry[]
      try {
        read++
        children = await readDir(path)
      } catch (error) {
        complete = false
        warnings.push(`无法读取 ${path}：${describeError(error)}`)
        continue
      }
      if (isProject(children)) projects.push(path)
      else if (level < depth) await visit(children, path, level + 1)
    }
  }

  await visit(rootEntries, root, 1)
  if (limitHit) {
    warnings.push(`目录过多，只扫描了前 ${maxDirectories} 个目录，结果不完整；可减少扫描层数`)
  }
  return { status: 'ok', projects, complete, warnings }
}

function isProject(entries: DirEntry[]): boolean {
  return entries.some(
    (entry) => (entry.isFile() || entry.isSymbolicLink()) && projectMarkers.has(entry.name)
  )
}

/** Real subdirectories worth searching, in a stable order so limits cut at the same place. */
function sortedSubdirectories(entries: DirEntry[]): DirEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        !entry.name.startsWith('.') &&
        !skippedDirectories.has(entry.name.toLowerCase())
    )
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

function describeError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') return '目录不存在'
  if (code === 'ENOTDIR') return '不是一个目录'
  if (code === 'EACCES' || code === 'EPERM') return '没有访问权限'
  return error instanceof Error ? error.message : String(error)
}
