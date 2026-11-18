import type { ScriptSource } from '@devhub/shared'

export const sourceLabels: Record<ScriptSource, string> = {
  npm: 'npm',
  maven: 'Maven',
  gradle: 'Gradle',
  go: 'Go',
  python: 'Python',
  custom: '自定义'
}
