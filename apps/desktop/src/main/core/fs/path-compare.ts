import { isAbsolute, relative, sep } from 'path'

// Windows paths are case-insensitive: C:\Repo and c:\repo are the same directory.
const key = (path: string, platform: NodeJS.Platform): string =>
  platform === 'win32' ? path.toLowerCase() : path

/** Compares two normalized absolute paths. */
export function samePath(a: string, b: string, platform: NodeJS.Platform): boolean {
  return key(a, platform) === key(b, platform)
}

/** True when `path` is `parent` itself or anywhere below it (both normalized and absolute). */
export function isWithin(path: string, parent: string, platform: NodeJS.Platform): boolean {
  const rel = relative(key(parent, platform), key(path, platform))
  // A child named like `..cache` is still inside: only a `..` segment leaves the parent.
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}
