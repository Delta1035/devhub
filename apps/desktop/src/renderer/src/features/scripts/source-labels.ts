import type { ScriptSource } from '@devhub/shared'

export const sourceLabels: Record<ScriptSource, string> = {
  npm: 'npm',
  maven: 'Maven',
  gradle: 'Gradle',
  go: 'Go',
  custom: '自定义'
}
