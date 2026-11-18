interface LaunchQueue {
  run<T>(keys: string[], launch: () => Promise<T>): Promise<T>
  idle(): Promise<void>
}

/** Starts sharing a script or port must finish their checks and launch in order. */
export function createLaunchQueue(): LaunchQueue {
  const pending = new Map<string, Promise<void>>()

  return {
    run<T>(keys: string[], launch: () => Promise<T>): Promise<T> {
      const unique = [...new Set(keys)]
      const ready = Promise.all(unique.map((key) => pending.get(key)))
      const result = ready.then(launch)
      const finished = result.then(
        () => undefined,
        () => undefined
      )
      for (const key of unique) pending.set(key, finished)
      void finished.then(() => {
        for (const key of unique) {
          if (pending.get(key) === finished) pending.delete(key)
        }
      })
      return result
    },
    async idle(): Promise<void> {
      await Promise.all(pending.values())
    }
  }
}
