import { SquareTerminal } from 'lucide-react'

/** Reserved space for per-run terminal tabs; filled in once process management lands. */
export function TerminalPanel(): React.JSX.Element {
  return (
    <section className="flex h-40 shrink-0 flex-col border-t bg-muted/30">
      <header className="flex items-center gap-2 border-b px-6 py-2 text-sm font-medium">
        <SquareTerminal className="size-4 text-muted-foreground" />
        终端
      </header>
      <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        运行脚本后在这里查看输出
      </p>
    </section>
  )
}
