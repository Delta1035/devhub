import type { Script, ScriptWarning } from '@devhub/shared'
import { createConfigDetector } from './config-detector'
import { createGradleDetector } from './gradle-detector'
import { createMavenDetector } from './maven-detector'
import { npmDetector } from './npm-detector'
import type { ScriptDetector } from './types'

/** All built-in detectors. Order here is the order scripts are listed in. */
export const createDefaultDetectors = (platform: NodeJS.Platform): ScriptDetector[] => [
  // The user's own scripts first.
  createConfigDetector({ platform }),
  npmDetector,
  createMavenDetector({ platform }),
  createGradleDetector({ platform })
]

export interface DetectionResult {
  scripts: Script[]
  warnings: ScriptWarning[]
}

/** Runs all detectors in parallel; a failing detector becomes a warning instead of an error. */
export async function detectScripts(
  dir: string,
  detectors: readonly ScriptDetector[]
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
