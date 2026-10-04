import type { ITheme } from '@xterm/xterm'
import { appearance, type UiStyle } from '@renderer/lib/appearance'

const colors = (background: string, foreground: string, selection: string): ITheme => ({
  background,
  foreground,
  cursor: foreground,
  cursorAccent: background,
  selectionBackground: selection
})

/** Terminal colors per design style, matching each style's surfaces. */
const themes: Record<UiStyle, { light: ITheme; dark: ITheme }> = {
  neutral: {
    light: colors('#fafafa', '#27272a', '#bfdbfe'),
    dark: colors('#18181b', '#e4e4e7', '#3f3f46')
  },
  material: {
    light: colors('#f7f2fa', '#1d1b20', '#eaddff'),
    dark: colors('#1d1b20', '#e6e0e9', '#4f378b')
  },
  fluent: {
    light: colors('#fbfbfb', '#1a1a1a', '#cce4f7'),
    dark: colors('#1c1c1c', '#cccccc', '#264f78')
  },
  nord: {
    light: colors('#e5e9f0', '#2e3440', '#d8dee9'),
    dark: colors('#2e3440', '#d8dee9', '#434c5e')
  },
  yaru: {
    light: colors('#ffffff', '#3d3d3d', '#f6c9b5'),
    // Ubuntu's classic aubergine terminal.
    dark: colors('#300a24', '#ffffff', '#5e2750')
  },
  terminal: {
    light: colors('#fbfaf5', '#1c1c1c', '#cde8d2'),
    dark: colors('#0a0c0a', '#c8dcc8', '#1f3a1f')
  }
}

export const terminalFontFamily =
  'ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", "Noto Sans Mono CJK SC", monospace'

const fontSizeKey = 'devhub.terminalFontSize'
const scrollbackKey = 'devhub.terminalScrollback'
const rendererKey = 'devhub.terminalRenderer'
const defaultFontSize = 13
export const fontSizeRange = { min: 9, max: 28 }
const defaultScrollback = 5000
export const scrollbackRange = { min: 1000, max: 100_000 }

const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
appearance.subscribe(notify)

const clamp = (value: number, range: { min: number; max: number }): number =>
  Math.min(range.max, Math.max(range.min, Math.round(value)))

const readNumber = (key: string, range: { min: number; max: number }, fallback: number): number => {
  const stored = Number(localStorage.getItem(key))
  return stored >= range.min && stored <= range.max ? stored : fallback
}

/** Terminal look shared by every terminal; changes apply to all open terminals at once. */
export const terminalPrefs = {
  theme: (): ITheme => themes[appearance.style()][appearance.isDark() ? 'dark' : 'light'],

  fontSize: (): number => readNumber(fontSizeKey, fontSizeRange, defaultFontSize),

  setFontSize(size: number): void {
    localStorage.setItem(fontSizeKey, String(clamp(size, fontSizeRange)))
    notify()
  },

  /** `delta` of 0 resets to the default size. */
  zoom(delta: number): void {
    this.setFontSize(delta === 0 ? defaultFontSize : this.fontSize() + delta)
  },

  /** Lines kept above the screen in each terminal. */
  scrollback: (): number => readNumber(scrollbackKey, scrollbackRange, defaultScrollback),

  setScrollback(lines: number): void {
    localStorage.setItem(scrollbackKey, String(clamp(lines, scrollbackRange)))
    notify()
  },

  /**
   * GPU rendering unless set to "dom" (a fallback for broken GPU drivers; E2E uses it because
   * WebGL draws text on a canvas that tests cannot read).
   */
  useWebgl: (): boolean => localStorage.getItem(rendererKey) !== 'dom',

  setUseWebgl(enabled: boolean): void {
    localStorage.setItem(rendererKey, enabled ? 'webgl' : 'dom')
    notify()
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
}
