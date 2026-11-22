import type { Project, Run } from './domain'

export type ProjectSortOrder = 'default' | 'name-asc' | 'name-desc' | 'path-asc' | 'path-desc'

export interface SortProjectsOptions {
  /**
   * Explicit sort order.
   * - 'default': active projects first (by latest run timestamp descending), then secondary comparator.
   * - 'name-asc': project name A-Z.
   * - 'name-desc': project name Z-A.
   * - 'path-asc': project path ascending.
   * - 'path-desc': project path descending.
   *
   * In all modes, pinned projects (pinnedAt) always appear first.
   */
  order?: ProjectSortOrder

  /**
   * Optional path getter for path-based sorting (e.g. relative to workspace).
   * Defaults to `project.path`.
   */
  getPath?: (project: Project) => string

  /**
   * Secondary comparison function when both projects have equal activity or equal sorting key.
   * In 'default' mode, defaults to comparing project name and path alphabetically.
   */
  secondary?: (a: Project, b: Project) => number
}

interface ProjectActivityStats {
  count: number
  latestStartedAt: number
}

function defaultSecondary(a: Project, b: Project): number {
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  return a.path.localeCompare(b.path)
}

/**
 * Returns true when the project has at least one run that has not exited.
 */
export function isProjectActive(projectId: string, runs: readonly Run[]): boolean {
  return runs.some((run) => run.projectId === projectId && run.status !== 'exited')
}

/**
 * Returns the live (non-exited) runs belonging to a project.
 */
export function activeRunsOf(projectId: string, runs: readonly Run[]): Run[] {
  return runs.filter((run) => run.projectId === projectId && run.status !== 'exited')
}

/**
 * Sorts projects so that currently active projects (those with non-exited runs)
 * appear first.
 *
 * Sorting precedence:
 * 1. Pinned projects before unpinned projects; multiple pins are ordered newest first.
 * 2. Active projects (with runs whose status !== 'exited') before inactive projects.
 * 3. Between active projects: latest started run timestamp descending (more recently activated first).
 * 4. If latest start times are equal: number of active runs descending.
 * 5. Ties between active projects, and all inactive projects: sorted by `secondary` comparator
 *    (defaults to project name, then path).
 *
 * Returns a new array without mutating the input.
 */
export function sortProjects(
  projects: readonly Project[],
  runs: readonly Run[],
  options?: SortProjectsOptions
): Project[] {
  const order = options?.order ?? 'default'
  const secondary = options?.secondary ?? defaultSecondary
  const getPath = options?.getPath ?? ((p: Project) => p.path)

  const stats = new Map<string, ProjectActivityStats>()
  if (order === 'default') {
    for (const run of runs) {
      if (run.status === 'exited') continue
      const time = Date.parse(run.startedAt) || 0
      const existing = stats.get(run.projectId)
      if (!existing) {
        stats.set(run.projectId, { count: 1, latestStartedAt: time })
      } else {
        existing.count += 1
        if (time > existing.latestStartedAt) {
          existing.latestStartedAt = time
        }
      }
    }
  }

  return [...projects].sort((a, b) => {
    if (a.pinnedAt && !b.pinnedAt) return -1
    if (!a.pinnedAt && b.pinnedAt) return 1
    if (a.pinnedAt && b.pinnedAt) {
      const byPinnedAt = Date.parse(b.pinnedAt) - Date.parse(a.pinnedAt)
      if (byPinnedAt !== 0) return byPinnedAt
    }

    if (order === 'name-asc') {
      const byName = a.name.localeCompare(b.name)
      if (byName !== 0) return byName
      return getPath(a).localeCompare(getPath(b))
    }

    if (order === 'name-desc') {
      const byName = b.name.localeCompare(a.name)
      if (byName !== 0) return byName
      return getPath(b).localeCompare(getPath(a))
    }

    if (order === 'path-asc') {
      const byPath = getPath(a).localeCompare(getPath(b))
      if (byPath !== 0) return byPath
      return a.name.localeCompare(b.name)
    }

    if (order === 'path-desc') {
      const byPath = getPath(b).localeCompare(getPath(a))
      if (byPath !== 0) return byPath
      return b.name.localeCompare(a.name)
    }

    // 'default'
    const aStats = stats.get(a.id)
    const bStats = stats.get(b.id)
    const aActive = (aStats?.count ?? 0) > 0
    const bActive = (bStats?.count ?? 0) > 0

    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1

    if (aActive && bActive && aStats && bStats) {
      if (bStats.latestStartedAt !== aStats.latestStartedAt) {
        return bStats.latestStartedAt - aStats.latestStartedAt
      }
      if (bStats.count !== aStats.count) {
        return bStats.count - aStats.count
      }
    }

    return secondary(a, b)
  })
}
