import '@xterm/xterm/css/xterm.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { isMac } from './terminal-keys'
import { TerminalSearch } from './terminal-search'
import { getTerminalSession } from './terminal-sessions'

const mod = isMac ? '⌘' : 'Ctrl+'

interface RunTerminalProps {
  runId: string
  /** False once the run has exited: keystrokes have nowhere to go. */
  acceptsInput: boolean
}

/**
 * Shows a run's terminal. The xterm instance outlives this component (see terminal-sessions),
 * so unmounting on a tab switch keeps its screen, scrollback and selection.
 */
export function RunTerminal({ runId, acceptsInput }: RunTerminalProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const session = useMemo(() => getTerminalSession(runId), [runId])
  const [searchOpen, setSearchOpen] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const touchScroll = useRef({ pointerId: -1, lastY: 0, remainder: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    session.attach(container, () => setSearchOpen(true))
    session.focus()
    return () => session.detach()
  }, [session])

  useEffect(() => session.setAcceptsInput(acceptsInput), [session, acceptsInput])

  const handleTouchPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType !== 'touch') return
    touchScroll.current = { pointerId: event.pointerId, lastY: event.clientY, remainder: 0 }
  }

  const handleTouchPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = touchScroll.current
    if (event.pointerType !== 'touch' || state.pointerId !== event.pointerId) return
    const delta = state.lastY - event.clientY
    state.lastY = event.clientY
    state.remainder += delta
    const lineHeight = Math.max(12, (session.terminal.options.fontSize ?? 13) * 1.2)
    const lines = Math.trunc(state.remainder / lineHeight)
    if (lines === 0) return
    session.terminal.scrollLines(-lines)
    state.remainder -= lines * lineHeight
  }

  const handleTouchPointerEnd = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (touchScroll.current.pointerId !== event.pointerId) return
    touchScroll.current.pointerId = -1
  }

  return (
    <ContextMenu onOpenChange={(open) => open && setHasSelection(session.terminal.hasSelection())}>
      <ContextMenuTrigger asChild>
        <div
          className="relative h-full w-full touch-none overflow-hidden rounded-md"
          onPointerDownCapture={handleTouchPointerDown}
          onPointerMoveCapture={handleTouchPointerMove}
          onPointerUpCapture={handleTouchPointerEnd}
          onPointerCancelCapture={handleTouchPointerEnd}
        >
          <div ref={containerRef} className="h-full w-full" data-terminal-run={runId} />
          {searchOpen && <TerminalSearch session={session} onClose={() => setSearchOpen(false)} />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem disabled={!hasSelection} onSelect={() => void session.copy()}>
          复制
          <ContextMenuShortcut>{mod}C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!acceptsInput} onSelect={() => void session.paste()}>
          粘贴
          <ContextMenuShortcut>{mod}V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => session.terminal.selectAll()}>全选</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => setSearchOpen(true)}>
          搜索
          <ContextMenuShortcut>{mod}F</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => session.terminal.clear()}>
          清屏
          <ContextMenuShortcut>{isMac ? '⌘K' : 'Ctrl+Shift+K'}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
