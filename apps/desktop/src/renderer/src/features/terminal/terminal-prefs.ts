import type { ITheme } from '@xterm/xterm'
import { appearance } from '@renderer/lib/appearance'

const colors = (
  background: string,
  foreground: string,
  cursor: string,
  selection: string
): ITheme => ({
  background,
  foreground,
  cursor,
  cursorAccent: background,
  selectionBackground: selection
})

/** Terminal colors for light and dark modes. */
const terminalThemes: { light: ITheme; dark: ITheme } = {
  light: colors('#fbfbfb', '#1a1a1a', '#059669', '#bfdbfe'),
  dark: colors('#08090c', '#e8ecf2', '#3ed598', '#1a2028')
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
  theme: (): ITheme => terminalThemes[appearance.isDark() ? 'dark' : 'light'],

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
