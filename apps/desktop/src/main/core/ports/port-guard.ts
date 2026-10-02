import type { PortConflict, Script } from '@devhub/shared'
import type { FindPortOwner } from './port-owner'

export interface PortGuardDeps {
  isPortInUse: (port: number) => Promise<boolean>
  findOwner: FindPortOwner
}

/** Lists the ports a script expects that something already listens on, with the holder. */
export function createPortGuard({ isPortInUse, findOwner }: PortGuardDeps) {
  return async (script: Pick<Script, 'ports'>): Promise<PortConflict[]> => {
    const conflicts = await Promise.all(
      (script.ports ?? []).map(async (port): Promise<PortConflict | null> => {
        if (!(await isPortInUse(port))) return null
        const owner = await findOwner(port)
        return { port, pid: owner?.pid ?? null, processName: owner?.name ?? null }
      })
    )
    return conflicts.filter((conflict) => conflict !== null)
  }
}
