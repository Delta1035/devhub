import type { Run, Script } from './domain'

export type ScriptSortOrder = 'default' | 'name-asc' | 'name-desc' | 'active-first'

export interface SortScriptsOptions {
  /**
   * Sort order for scripts:
   * - 'default': keep original detector/configuration order.
   * - 'name-asc': sort by script name alphabetically ascending.
   * - 'name-desc': sort by script name alphabetically descending.
   * - 'active-first': scripts currently running appear first (latest started first).
   */
  order?: ScriptSortOrder
  /**
   * Active runs for determining which scripts are currently running.
   */
  runs?: readonly Run[]
  /**
   * Project ID to match against runs when using 'active-first'.
   */
  projectId?: string
}

/**
 * Sorts scripts according to the specified sort order.
 * Returns a new array without mutating the input.
 */
export function sortScripts(scripts: readonly Script[], options?: SortScriptsOptions): Script[] {
  const order = options?.order ?? 'default'
  if (order === 'default') {
    return [...scripts]
  }

  if (order === 'name-asc') {
    return [...scripts].sort((a, b) => {
      const byName = a.name.localeCompare(b.name)
      if (byName !== 0) return byName
      return a.command.localeCompare(b.command)
    })
  }

  if (order === 'name-desc') {
    return [...scripts].sort((a, b) => {
      const byName = b.name.localeCompare(a.name)
      if (byName !== 0) return byName
      return b.command.localeCompare(a.command)
    })
  }

  // 'active-first'
  const runs = options?.runs ?? []
  const projectId = options?.projectId

  // Map scriptId -> latest startedAt timestamp
  const activeScriptTimes = new Map<string, number>()
  for (const run of runs) {
    if (run.status === 'exited') continue
    if (run.kind === 'script' && (!projectId || run.projectId === projectId)) {
      const time = Date.parse(run.startedAt) || 0
      const existing = activeScriptTimes.get(run.scriptId)
      if (existing === undefined || time > existing) {
        activeScriptTimes.set(run.scriptId, time)
      }
    }
  }

  return [...scripts].sort((a, b) => {
    const aActiveTime = activeScriptTimes.get(a.id)
    const bActiveTime = activeScriptTimes.get(b.id)
    const aActive = aActiveTime !== undefined
    const bActive = bActiveTime !== undefined

    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    if (aActive && bActive && aActiveTime !== undefined && bActiveTime !== undefined) {
      if (bActiveTime !== aActiveTime) {
        return bActiveTime - aActiveTime
      }
    }

    const byName = a.name.localeCompare(b.name)
    if (byName !== 0) return byName
    return a.command.localeCompare(b.command)
  })
}
