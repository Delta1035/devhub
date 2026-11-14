import { useEffect, useState } from 'react'

/** Returns the current timestamp, ticking on a timer while active. */
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])

  return now
}
