import type { ITheme } from '@xterm/xterm'
import { appearance } from '@renderer/lib/appearance'

const lightTheme: ITheme = {
  background: '#fafafa',
  foreground: '#27272a',
  cursor: '#27272a',
  cursorAccent: '#fafafa',
  selectionBackground: '#bfdbfe'
}
const darkTheme: ITheme = {
  background: '#18181b',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#18181b',
  selectionBackground: '#3f3f46'
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
  theme: (): ITheme => (appearance.isDark() ? darkTheme : lightTheme),

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
