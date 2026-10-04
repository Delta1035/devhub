/** Light/dark mode: follow the OS by default, or a fixed choice stored per device. */
export type ThemePreference = 'system' | 'light' | 'dark'

/**
 * Design style: a set of CSS token overrides (colors, radius, font) selected by
 * `data-style` on <html>. Components only use semantic tokens, so they need no changes.
 */
export const uiStyles = ['neutral', 'material', 'fluent'] as const
export type UiStyle = (typeof uiStyles)[number]

const themeKey = 'devhub.theme'
const styleKey = 'devhub.style'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  const stored = localStorage.getItem(themeKey)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function readStyle(): UiStyle {
  const stored = localStorage.getItem(styleKey)
  return uiStyles.find((style) => style === stored) ?? 'neutral'
}

function apply(): void {
  const root = document.documentElement
  root.classList.toggle('dark', appearance.isDark())
  root.dataset.style = readStyle()
  listeners.forEach((listener) => listener())
}

export const appearance = {
  preference: readPreference,
  style: readStyle,

  isDark(): boolean {
    const preference = readPreference()
    return preference === 'system' ? darkQuery.matches : preference === 'dark'
  },

  setPreference(preference: ThemePreference): void {
    localStorage.setItem(themeKey, preference)
    apply()
  },

  setStyle(style: UiStyle): void {
    localStorage.setItem(styleKey, style)
    apply()
  },

  /** Notified whenever the effective theme or style may have changed. */
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
