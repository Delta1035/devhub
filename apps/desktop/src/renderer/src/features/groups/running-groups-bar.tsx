import { useState } from 'react'
import { Loader2, Square, X as XIcon } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { describeActiveGroup, type ActiveGroupView } from './use-active-groups'
import { useStopGroup } from './use-groups'

interface RunningGroupsBarProps {
  groups: ActiveGroupView[]
  onSelectGroup: (groupId: string) => void
}

/** Lists active batch runs above the sidebar tabs, so they stay visible on either tab. */
export function RunningGroupsBar({
  groups,
  onSelectGroup
}: RunningGroupsBarProps): React.JSX.Element | null {
  const stop = useStopGroup()
  const [error, setError] = useState<string | null>(null)
  if (groups.length === 0) return null
  return (
    <section
      className="flex shrink-0 flex-col gap-0.5 rounded-lg border bg-muted/40 p-1"
      aria-label="正在运行的批量任务"
    >
      {error && (
        <p className="flex items-start gap-1 px-1.5 text-xs text-destructive">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="关闭">
            <XIcon className="size-3" />
          </button>
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {groups.map((group) => {
          const stopping = stop.isPending && stop.variables === group.groupId
          return (
            <li key={group.groupId} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectGroup(group.groupId)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-background"
                title={`查看 ${group.name}`}
              >
                {group.phase === 'starting' ? (
                  <Loader2 className="size-3 shrink-0 animate-spin text-info" />
                ) : (
                  <span className="size-1.5 shrink-0 rounded-full bg-success" />
                )}
                <span className="truncate font-medium">{group.name}</span>
                <span
                  className={cn(
                    'ml-auto shrink-0 tabular-nums text-muted-foreground',
                    group.phase === 'starting' && 'text-info'
                  )}
                >
                  {describeActiveGroup(group)}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={stopping}
                onClick={() => stop.mutate(group.groupId, { onError: (e) => setError(e.message) })}
                aria-label={`停止 ${group.name}`}
                title="停止全部（结束每个脚本的整个进程树）"
              >
                {stopping ? <Loader2 className="animate-spin" /> : <Square />}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
