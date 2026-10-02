import type { ITheme } from '@xterm/xterm'

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
const rendererKey = 'devhub.terminalRenderer'
const defaultFontSize = 13
const minFontSize = 9
const maxFontSize = 28

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
darkQuery.addEventListener('change', notify)

/** Terminal look shared by every terminal; changes apply to all open terminals at once. */
export const terminalPrefs = {
  theme: (): ITheme => (darkQuery.matches ? darkTheme : lightTheme),

  fontSize(): number {
    const stored = Number(localStorage.getItem(fontSizeKey))
    return stored >= minFontSize && stored <= maxFontSize ? stored : defaultFontSize
  },

  /** `delta` of 0 resets to the default size. */
  zoom(delta: number): void {
    const next = delta === 0 ? defaultFontSize : this.fontSize() + delta
    localStorage.setItem(fontSizeKey, String(Math.min(maxFontSize, Math.max(minFontSize, next))))
    notify()
  },

  /**
   * GPU rendering unless set to "dom" (a fallback for broken GPU drivers; E2E uses it because
   * WebGL draws text on a canvas that tests cannot read).
   */
  useWebgl: (): boolean => localStorage.getItem(rendererKey) !== 'dom',

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
}
