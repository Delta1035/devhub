/** Light/dark mode: follow the OS by default, or a fixed choice stored per device. */
export type ThemePreference = 'system' | 'light' | 'dark'

const themeKey = 'devhub.theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(themeKey)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function apply(): void {
  document.documentElement.classList.toggle('dark', appearance.isDark())
  listeners.forEach((listener) => listener())
}

export const appearance = {
  preference: readPreference,

  isDark(): boolean {
    const preference = readPreference()
    return preference === 'system' ? darkQuery.matches : preference === 'dark'
  },

  setPreference(preference: ThemePreference): void {
    localStorage.setItem(themeKey, preference)
    apply()
  },

  /** Notified whenever the effective theme may have changed. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  /** Applies the theme and follows OS changes; call once at startup. */
  start(): void {
    apply()
    darkQuery.addEventListener('change', apply)
  }
}
