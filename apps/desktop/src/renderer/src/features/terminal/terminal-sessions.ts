import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { OutputCursor } from '@devhub/shared'
import { access, api, events, shell } from '@renderer/api'
import { createKeyHandler, isMac } from './terminal-keys'
import { terminalFontFamily, terminalPrefs } from './terminal-prefs'

const linkHint = isMac ? '⌘+点击打开链接' : 'Ctrl+点击打开链接'

/** Desktop opens through the validated ShellApi; a remote client falls back to the browser. */
function openLink(event: MouseEvent, uri: string): void {
  // Require the modifier (VS Code convention) so selecting text never opens a page by accident.
  if (!(isMac ? event.metaKey : event.ctrlKey)) return
  if (shell) shell.openExternal(uri).catch((error: unknown) => console.warn(error))
  else window.open(uri, '_blank', 'noopener')
}

/**
 * One xterm instance per run, kept alive while its tab exists. Switching tabs only moves the
 * instance's DOM node in and out of the panel, so full-screen programs (vim, less), scroll
 * position and selection survive, and hidden terminals keep receiving output.
 */
export class TerminalSession {
  readonly terminal: Terminal
  readonly search = new SearchAddon()

  /** Provided by the mounted view so Ctrl+F can open its search bar. */
  private onSearchRequest: (() => void) | null = null
  private readonly fit = new FitAddon()
  /** The node xterm renders into; moved between containers as tabs switch. */
  private readonly host = document.createElement('div')
  private opened = false
  private webgl: WebglAddon | null = null
  private acceptsInput = true
  private readonly cursor = new OutputCursor()
  /** Live chunks received before the snapshot arrived; null once it has been applied. */
  private held: { offset: number; data: string }[] | null = []
  private observer: ResizeObserver | null = null
  private resizeTimer: ReturnType<typeof setTimeout> | undefined
  private lastSize = ''
  private disposed = false
  private readonly unsubscribePrefs: () => void

  constructor(readonly runId: string) {
    this.host.className = 'h-full w-full'
    this.terminal = new Terminal({
      allowProposedApi: true, // Unicode 11 widths and search highlights
      fontFamily: terminalFontFamily,
      fontSize: terminalPrefs.fontSize(),
      scrollback: terminalPrefs.scrollback(),
      cursorBlink: true,
      theme: terminalPrefs.theme()
    })
    this.terminal.loadAddon(this.fit)
    this.terminal.loadAddon(this.search)
    this.terminal.loadAddon(new Unicode11Addon())
    this.terminal.unicode.activeVersion = '11'
    this.terminal.loadAddon(
      new WebLinksAddon(openLink, {
        hover: () => (this.host.title = linkHint),
        leave: () => (this.host.title = '')
      })
    )
    this.terminal.attachCustomKeyEventHandler(
      createKeyHandler({
        hasSelection: () => this.terminal.hasSelection(),
        copy: () => void this.copy(),
        paste: () => void this.paste(),
        openSearch: () => this.onSearchRequest?.(),
        clear: () => this.terminal.clear(),
        zoom: (delta) => terminalPrefs.zoom(delta)
      })
    )
    this.terminal.onData((data) => {
      if (this.acceptsInput) api.writeRunInput(this.runId, data).catch(() => undefined)
    })
    this.unsubscribePrefs = terminalPrefs.subscribe(() => this.applyPrefs())

    // Live chunks are held until the snapshot arrives; the cursor drops what it already had.
    api
      .getRunOutput(runId)
      .then((snapshot) => {
        if (!this.disposed) this.terminal.write(this.cursor.acceptSnapshot(snapshot))
      })
      .catch(() => undefined) // Removed meanwhile; live chunks (if any) still render.
      .finally(() => {
        const held = this.held ?? []
        this.held = null
        for (const chunk of held) this.receive(chunk.offset, chunk.data)
      })
  }

  receive(offset: number, data: string): void {
    if (this.disposed) return
    if (this.held) this.held.push({ offset, data })
    else this.terminal.write(this.cursor.accept(offset, data))
  }

  /** Shows the terminal in `container`; only the visible terminal holds a WebGL context. */
  attach(container: HTMLElement, onSearchRequest: () => void): void {
    this.onSearchRequest = onSearchRequest
    container.appendChild(this.host)
    if (!this.opened) {
      this.terminal.open(this.host)
      this.opened = true
      // Padding on xterm's own element: the fit addon subtracts it when measuring.
      if (this.terminal.element) this.terminal.element.style.padding = '6px 8px'
    }
    this.applyPrefs()

    this.observer = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => this.syncSize(), 50)
    })
    this.observer.observe(container)
    this.syncSize()
  }

  detach(): void {
    this.onSearchRequest = null
    this.observer?.disconnect()
    this.observer = null
    clearTimeout(this.resizeTimer)
    this.disableWebgl()
    this.host.remove()
  }

  focus(): void {
    this.terminal.focus()
  }

  setAcceptsInput(running: boolean): void {
    // A phone may type into terminals only when the desktop allows remote terminals.
    const accepts = running && access.terminal
    this.acceptsInput = accepts
    this.terminal.options.disableStdin = !accepts
    this.terminal.options.cursorStyle = accepts ? 'block' : 'underline'
    this.terminal.options.cursorBlink = accepts
  }

  async copy(): Promise<void> {
    const text = this.terminal.getSelection()
    // Browsers only allow the clipboard on HTTPS or localhost.
    if (!text || !navigator.clipboard) return
    await navigator.clipboard.writeText(text)
    this.terminal.clearSelection()
  }

  /** Goes through xterm so bracketed paste is used when the program asked for it. */
  async paste(): Promise<void> {
    if (!navigator.clipboard) return
    const text = await navigator.clipboard.readText()
    if (text && this.acceptsInput) this.terminal.paste(text)
    this.terminal.focus()
  }

  dispose(): void {
    this.disposed = true
    this.detach()
    this.unsubscribePrefs()
    this.terminal.dispose()
  }

  private enableWebgl(): void {
    if (this.webgl) return
    try {
      const webgl = new WebglAddon()
      // A lost context (GPU reset, too many contexts) falls back to the DOM renderer.
      webgl.onContextLoss(() => {
        webgl.dispose()
        this.webgl = null
      })
      this.terminal.loadAddon(webgl)
      this.webgl = webgl
    } catch {
      this.webgl = null // No WebGL available: xterm keeps its DOM renderer.
    }
  }

  private disableWebgl(): void {
    this.webgl?.dispose()
    this.webgl = null
  }

  private applyPrefs(): void {
    const theme = terminalPrefs.theme()
    this.terminal.options.theme = theme
    this.terminal.options.fontSize = terminalPrefs.fontSize()
    this.terminal.options.scrollback = terminalPrefs.scrollback()
    this.host.style.backgroundColor = theme.background ?? ''
    if (this.host.isConnected) {
      // Only the visible terminal holds a WebGL context; follow the renderer setting live.
      if (terminalPrefs.useWebgl()) this.enableWebgl()
      else this.disableWebgl()
      this.syncSize()
    }
  }

  /** Keeps the PTY size in step with the panel so full-screen output wraps correctly. */
  private syncSize(): void {
    if (!this.host.isConnected) return
    this.fit.fit()
    const size = `${this.terminal.cols}x${this.terminal.rows}`
    if (size === this.lastSize) return
    this.lastSize = size
    // A phone that only watches must not reflow the desktop's terminal to its narrow screen.
    if (!access.terminal) return
    api.resizeRun(this.runId, this.terminal.cols, this.terminal.rows).catch(() => undefined)
  }
}

const sessions = new Map<string, TerminalSession>()
let unsubscribeEvents: (() => void) | null = null

/** The terminal for a run, created on first use. */
export function getTerminalSession(runId: string): TerminalSession {
  // One subscription feeds every session: output goes to the run's terminal, removal frees it.
  unsubscribeEvents ??= events.subscribe((event) => {
    if (event.type === 'run-output') {
      sessions.get(event.runId)?.receive(event.offset, event.data)
    } else if (event.type === 'run-removed') {
      sessions.get(event.runId)?.dispose()
      sessions.delete(event.runId)
    }
  })

  let session = sessions.get(runId)
  if (!session) {
    session = new TerminalSession(runId)
    sessions.set(runId, session)
  }
  return session
}
