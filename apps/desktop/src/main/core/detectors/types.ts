import type { Script, ScriptSource } from '@devhub/shared'

/**
 * Discovers runnable scripts of one project type. Adding a project type = adding one detector.
 * Returns [] when the directory is not of this type; throws (with a user-facing message)
 * when it is but the build file cannot be read, so other detectors still contribute.
 */
export interface ScriptDetector {
  source: ScriptSource
  detect(dir: string): Promise<Script[]>
}
