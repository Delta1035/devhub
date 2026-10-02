import type { Script, ScriptWarning } from '@devhub/shared'
import { npmDetector } from './npm-detector'
import type { ScriptDetector } from './types'

export const defaultDetectors: readonly ScriptDetector[] = [npmDetector]

export interface DetectionResult {
  scripts: Script[]
  warnings: ScriptWarning[]
}

/** Runs all detectors in parallel; a failing detector becomes a warning instead of an error. */
export async function detectScripts(
  dir: string,
  detectors: readonly ScriptDetector[] = defaultDetectors
): Promise<DetectionResult> {
  const results = await Promise.all(
    detectors.map(async (detector) => {
      try {
        return { scripts: await detector.detect(dir) }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { warning: { source: detector.source, message } }
      }
    })
  )
  const scripts: Script[] = []
  const warnings: ScriptWarning[] = []
  for (const result of results) {
    if (result.scripts) scripts.push(...result.scripts)
    if (result.warning) warnings.push(result.warning)
  }
  return { scripts, warnings }
}
