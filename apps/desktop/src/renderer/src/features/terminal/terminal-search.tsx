import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import type { ISearchOptions } from '@xterm/addon-search'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { TerminalSession } from './terminal-sessions'

// Highlight colors must be #RRGGBB for the search addon.
const decorations: ISearchOptions['decorations'] = {
  matchBackground: '#fde68a',
  matchOverviewRuler: '#f59e0b',
  activeMatchBackground: '#f97316',
  activeMatchColorOverviewRuler: '#ea580c'
}

interface TerminalSearchProps {
  session: TerminalSession
  onClose: () => void
}

/** Ctrl+F search over the terminal's scrollback, with match highlights and a counter. */
export function TerminalSearch({ session, onClose }: TerminalSearchProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  // Opening the bar with text selected searches for that text right away.
  const [initialTerm] = useState(() => session.terminal.getSelection())
  const [term, setTerm] = useState(initialTerm)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [regex, setRegex] = useState(false)
  const [results, setResults] = useState<{ index: number; count: number } | null>(null)

  useEffect(() => {
    inputRef.current?.select()
    const subscription = session.search.onDidChangeResults(({ resultIndex, resultCount }) =>
      setResults({ index: resultIndex, count: resultCount })
    )
    if (initialTerm) session.search.findNext(initialTerm, { incremental: true, decorations })
    return () => {
      subscription.dispose()
      session.search.clearDecorations()
    }
  }, [session, initialTerm])

  const options = (
    incremental: boolean,
    override: Partial<ISearchOptions> = {}
  ): ISearchOptions => ({ caseSensitive, regex, incremental, decorations, ...override })

  /** Re-runs the search as the query or an option changes; incremental keeps the match. */
  const searchFor = (query: string, override: Partial<ISearchOptions> = {}): void => {
    if (query) session.search.findNext(query, options(true, override))
    else session.search.clearDecorations()
  }

  const close = (): void => {
    onClose()
    session.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') close()
    else if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) session.search.findPrevious(term, options(false))
      else session.search.findNext(term, options(false))
    }
  }

  // Results of a cleared query are stale, so an empty query shows nothing.
  const summary = !term
    ? ''
    : results === null || results.count === 0
      ? '无结果'
      : results.index < 0
        ? `${results.count}+ 项`
        : `${results.index + 1}/${results.count}`

  return (
    <div
      role="search"
      className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-md border bg-popover p-1 shadow-md"
    >
      <input
        ref={inputRef}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value)
          searchFor(event.target.value)
        }}
        onKeyDown={onKeyDown}
        placeholder="搜索"
        aria-label="搜索终端输出"
        className="h-6 w-44 rounded-sm bg-transparent px-1.5 text-xs outline-none"
      />
      <span className="w-14 text-center text-[11px] text-muted-foreground tabular-nums">
        {summary}
      </span>
      <ToggleButton
        active={caseSensitive}
        label="区分大小写"
        onClick={() => {
          setCaseSensitive(!caseSensitive)
          searchFor(term, { caseSensitive: !caseSensitive })
        }}
      >
        Aa
      </ToggleButton>
      <ToggleButton
        active={regex}
        label="正则表达式"
        onClick={() => {
          setRegex(!regex)
          searchFor(term, { regex: !regex })
        }}
      >
        .*
      </ToggleButton>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => session.search.findPrevious(term, options(false))}
        aria-label="上一个"
        title="上一个 (Shift+Enter)"
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => session.search.findNext(term, options(false))}
        aria-label="下一个"
        title="下一个 (Enter)"
      >
        <ChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={close}
        aria-label="关闭搜索"
        title="关闭 (Esc)"
      >
        <X />
      </Button>
    </div>
  )
}

interface ToggleButtonProps {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}

function ToggleButton({ active, onClick, label, children }: ToggleButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'h-6 rounded-sm px-1.5 font-mono text-[11px] text-muted-foreground hover:bg-muted',
        active && 'bg-primary/15 text-foreground'
      )}
    >
      {children}
    </button>
  )
}
