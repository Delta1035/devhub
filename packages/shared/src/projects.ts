import type { Project, Run } from './domain'

export interface SortProjectsOptions {
  /**
   * Secondary comparison function when both projects have equal activity.
   * Defaults to comparing project name and path alphabetically.
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
 * 1. Active projects (with runs whose status !== 'exited') before inactive projects.
 * 2. Between active projects: latest started run timestamp descending (more recently activated first).
 * 3. If latest start times are equal: number of active runs descending.
 * 4. Ties between active projects, and all inactive projects: sorted by `secondary` comparator
 *    (defaults to project name, then path).
 *
 * Returns a new array without mutating the input.
 */
export function sortProjects(
  projects: readonly Project[],
  runs: readonly Run[],
  options?: SortProjectsOptions
): Project[] {
  const secondary = options?.secondary ?? defaultSecondary

  const stats = new Map<string, ProjectActivityStats>()
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

  return [...projects].sort((a, b) => {
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
