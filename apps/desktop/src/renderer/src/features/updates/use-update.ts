import { useEffect, useState } from 'react'
import type { UpdateStatus } from '@devhub/shared'
import { shell } from '@renderer/api'

/** Live update status; null in a remote client (no shell) or before the first answer. */
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    if (!shell) return
    let active = true
    shell.getUpdateStatus().then(
      (initial) => active && setStatus(initial),
      () => undefined
    )
    const unsubscribe = shell.onUpdateStatus(setStatus)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return status
}

/** The update actions; each is a no-op without a shell. */
export const updateActions = {
  check: () => shell?.checkForUpdates(),
  download: () => shell?.downloadUpdate(),
  install: () => shell?.installUpdate()
}
