export interface TerminalKeyActions {
  hasSelection(): boolean
  copy(): void
  paste(): void
  openSearch(): void
  clear(): void
  /** +1 / -1 to step the font size, 0 to reset it. */
  zoom(delta: number): void
}

export const isMac = navigator.userAgent.includes('Mac')

/**
 * Shortcuts handled by DevHub instead of being sent to the process, following Windows
 * Terminal / VS Code: Ctrl+C copies only when text is selected, otherwise it interrupts.
 * Returning false keeps xterm from forwarding the key; preventDefault also stops Electron's
 * default menu (e.g. Ctrl+= zooming the whole page) and the browser's own paste.
 */
export function createKeyHandler(actions: TerminalKeyActions): (event: KeyboardEvent) => boolean {
  return (event) => {
    const mod = isMac ? event.metaKey : event.ctrlKey
    if (!mod || event.altKey) return true
    const key = event.key.toLowerCase()
    const shift = event.shiftKey

    let action: (() => void) | null = null
    if (key === 'c' && (shift || actions.hasSelection())) action = actions.copy
    else if (key === 'v') action = actions.paste
    else if (key === 'f' && !shift) action = actions.openSearch
    else if (key === 'k' && (shift || isMac)) action = actions.clear
    else if (key === '=' || key === '+') action = () => actions.zoom(1)
    else if (key === '-' || key === '_') action = () => actions.zoom(-1)
    else if (key === '0' && !shift) action = () => actions.zoom(0)
    if (!action) return true

    event.preventDefault()
    // Act once per key press; keyup/keypress of the same combination are swallowed too.
    if (event.type === 'keydown') action()
    return false
  }
}
