import { useSyncExternalStore } from 'react'

/** Whether a CSS media query currently matches; follows window resizes and rotation. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches
  )
}

/** Below Tailwind's `md` breakpoint: phones, where the sidebar becomes a drawer. */
export const narrowQuery = '(max-width: 767.98px)'
