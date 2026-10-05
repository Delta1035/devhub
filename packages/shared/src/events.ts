import type { Run } from './domain'
import type { GroupRunState } from './groups'
import type { RunHealth } from './health'
import type { Settings } from './settings'

/**
 * Pushed from the core to every connected UI. Desktop: Electron IPC; remote: Server-Sent Events.
 * Output offsets count characters of the run's whole output stream, so a client can stitch
 * a snapshot (`getRunOutput`) and live events together without gaps or duplicates.
 */
export type DevhubEvent =
  | { type: 'run-updated'; run: Run }
  | { type: 'run-removed'; runId: string }
  | { type: 'run-output'; runId: string; offset: number; data: string }
  /** Emitted after history changes have been processed, including clear operations. */
  | { type: 'history-updated'; projectId: string; scriptId: string }
  | { type: 'group-updated'; state: GroupRunState }
  /** `health` is null once the run is no longer checked (stopping, exited, removed). */
  | { type: 'run-health'; runId: string; health: RunHealth | null }
  | { type: 'settings-updated'; settings: Settings }
  /** Projects or workspaces changed in the core (a rescan, a workspace edit); refetch both. */
  | { type: 'projects-updated' }

export interface DevhubEvents {
  /** Returns a function that cancels the subscription. */
  subscribe(listener: (event: DevhubEvent) => void): () => void
}

export const devhubEventChannel = 'devhub:event'

/** Recent output of a run. `end` is the stream position right after `data`. */
export interface RunOutputSnapshot {
  data: string
  end: number
}

/**
 * Tracks how much of a run's output stream has been written to a terminal and returns only
 * the unseen part of each chunk. A chunk that starts after the cursor (output lost to the
 * buffer cap) is accepted as-is.
 */
export class OutputCursor {
  private position = 0

  accept(offset: number, data: string): string {
    const end = offset + data.length
    if (end <= this.position) return ''
    const fresh = data.slice(Math.max(0, this.position - offset))
    this.position = end
    return fresh
  }

  acceptSnapshot(snapshot: RunOutputSnapshot): string {
    return this.accept(snapshot.end - snapshot.data.length, snapshot.data)
  }
}
