import { ChevronDown, Loader2, Plus } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useShells, useStartShell } from './use-shells'

interface NewTerminalButtonProps {
  projectId: string
  onStarted: (run: Run) => void
  onError: (error: Error) => void
}

/** "+" opens the default shell; the chevron lists every installed shell. */
export function NewTerminalButton({
  projectId,
  onStarted,
  onError
}: NewTerminalButtonProps): React.JSX.Element {
  const shells = useShells()
  const start = useStartShell()
  const defaultShell = shells.data?.[0]
  const noShell = shells.isSuccess && !defaultShell

  return (
    <div className="ml-1 flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={start.isPending || noShell}
        onClick={() => start.mutate({ projectId }, { onSuccess: onStarted, onError })}
        title={
          noShell ? '未检测到可用的终端程序' : `新建终端（${defaultShell?.name ?? '默认 shell'}）`
        }
        aria-label="新建终端"
      >
        {start.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
      </Button>
      {shells.data && shells.data.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={start.isPending}
              title="选择终端类型"
              aria-label="选择终端类型"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuLabel>新建终端</DropdownMenuLabel>
            {shells.data.map((shell, index) => (
              <DropdownMenuItem
                key={shell.id}
                className="whitespace-nowrap"
                onSelect={() =>
                  start.mutate({ projectId, shellId: shell.id }, { onSuccess: onStarted, onError })
                }
              >
                {shell.name}
                {index === 0 && <span className="ml-auto text-xs text-muted-foreground">默认</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
