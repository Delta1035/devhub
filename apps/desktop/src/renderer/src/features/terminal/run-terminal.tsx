import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal, type ITheme } from '@xterm/xterm'
import { OutputCursor } from '@devhub/shared'
import { api, events } from '@renderer/api'

// Opaque on purpose: xterm renders a transparent background as black. The wrapper uses the
// same color so the padding around the grid blends in.
const lightTheme: ITheme = {
  background: '#fafafa',
  foreground: '#27272a',
  cursor: '#27272a',
  selectionBackground: '#d4d4d8'
}
const darkTheme: ITheme = {
  background: '#18181b',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  selectionBackground: '#52525b'
}

interface RunTerminalProps {
  runId: string
  /** False once the run has exited: keystrokes have nowhere to go. */
  acceptsInput: boolean
}

/**
 * Renders one run's output. Created per tab: switching tabs rebuilds it from the snapshot,
 * which keeps memory flat no matter how many runs exist.
 */
export function RunTerminal({ runId, acceptsInput }: RunTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const terminal = new Terminal({
      fontFamily: 'ui-monospace, "Cascadia Mono", Consolas, "DejaVu Sans Mono", monospace',
      fontSize: 12,
      scrollback: 5000,
      theme: darkQuery.matches ? darkTheme : lightTheme
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(container)
    terminalRef.current = terminal

    // Subscribe before fetching the snapshot and hold live chunks until it arrives;
    // OutputCursor then drops whatever the snapshot already contained.
    let disposed = false
    const cursor = new OutputCursor()
    let held: { offset: number; data: string }[] | null = []
    const unsubscribe = events.subscribe((event) => {
      if (event.type !== 'run-output' || event.runId !== runId) return
      if (held) held.push(event)
      else terminal.write(cursor.accept(event.offset, event.data))
    })
    api
      .getRunOutput(runId)
      .then((snapshot) => {
        if (disposed) return
        terminal.write(cursor.acceptSnapshot(snapshot))
        for (const chunk of held ?? []) terminal.write(cursor.accept(chunk.offset, chunk.data))
      })
      // The run was removed meanwhile; live events (if any) still render.
      .catch(() => undefined)
      .finally(() => {
        held = null
      })

    const input = terminal.onData((data) => {
      api.writeRunInput(runId, data).catch(() => undefined)
    })

    // Keep the PTY size in step with the panel so full-screen output wraps correctly.
    let lastSize = ''
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const syncSize = (): void => {
      fit.fit()
      const size = `${terminal.cols}x${terminal.rows}`
      if (size === lastSize) return
      lastSize = size
      api.resizeRun(runId, terminal.cols, terminal.rows).catch(() => undefined)
    }
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(syncSize, 50)
    })
    observer.observe(container)
    syncSize()

    const applyTheme = (): void => {
      const theme = darkQuery.matches ? darkTheme : lightTheme
      terminal.options.theme = theme
      container.style.backgroundColor = theme.background ?? ''
    }
    applyTheme()
    darkQuery.addEventListener('change', applyTheme)

    return () => {
      disposed = true
      unsubscribe()
      input.dispose()
      observer.disconnect()
      clearTimeout(resizeTimer)
      darkQuery.removeEventListener('change', applyTheme)
      terminalRef.current = null
      terminal.dispose()
    }
  }, [runId])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    terminal.options.disableStdin = !acceptsInput
    terminal.options.cursorStyle = acceptsInput ? 'block' : 'underline'
  }, [acceptsInput, runId])

  return <div ref={containerRef} className="h-full w-full rounded-md p-2" />
}
