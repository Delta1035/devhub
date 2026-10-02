import { useEffect, useState } from 'react'
import type { WindowState } from '@devhub/shared'
import { shell } from '@renderer/api'

/** Live state of the desktop window; null in a remote client (no shell) or before the first answer. */
export function useWindowState(): WindowState | null {
  const [state, setState] = useState<WindowState | null>(null)
  useEffect(() => {
    if (!shell) return
    let active = true
    shell.getWindowState().then(
      (initial) => active && setState(initial),
      () => undefined
    )
    const unsubscribe = shell.onWindowState(setState)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return state
}
