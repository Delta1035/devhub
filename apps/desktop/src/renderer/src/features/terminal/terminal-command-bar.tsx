import { useState } from 'react'
import type { Run } from '@devhub/shared'
import { api } from '@renderer/api'

interface TerminalCommandBarProps {
  activeRun: Run | undefined
}

export function TerminalCommandBar({ activeRun }: TerminalCommandBarProps): React.JSX.Element {
  const [command, setCommand] = useState('')
  const canInput = Boolean(activeRun && activeRun.status !== 'exited')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && command.trim() && activeRun) {
      api.writeRunInput(activeRun.id, command + '\r').catch(() => undefined)
      setCommand('')
    }
  }

  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-2 border-t border-border/80 bg-background/95 px-3 font-mono text-xs"
      aria-label="终端命令行"
    >
      <span className="text-sm font-bold text-primary select-none">›</span>
      <input
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!canInput}
        placeholder={
          canInput
            ? `向 ${activeRun?.title ?? '终端'} 发送输入（回车执行）…`
            : '当前终端已结束，无法接收输入'
        }
        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none disabled:cursor-not-allowed disabled:text-muted-foreground/40"
      />
      <div className="hidden shrink-0 items-center gap-2 font-sans text-[10px] text-muted-foreground sm:flex">
        <span>Ctrl+C 中断</span>
        <span>·</span>
        <span>Ctrl+L 清屏</span>
        <span>·</span>
        <span>Ctrl+Shift+C 复制</span>
      </div>
    </footer>
  )
}
