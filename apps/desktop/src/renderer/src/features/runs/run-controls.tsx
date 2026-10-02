import { Loader2, Play, RotateCw, Square } from 'lucide-react'
import type { Run } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useRestartRun, useStartScript, useStopRun } from './use-runs'

interface RunControlsProps {
  projectId: string
  scriptId: string
  scriptName: string
  /** Latest run of this script, if any. */
  run: Run | undefined
  /** Receives start/stop failures so the list can show them in one place. */
  onError: (error: Error) => void
  /** Called with the new run after a start or restart, e.g. to focus its terminal tab. */
  onStarted: (run: Run) => void
}

export function RunControls({
  projectId,
  scriptId,
  scriptName,
  run,
  onError,
  onStarted
}: RunControlsProps): React.JSX.Element {
  const start = useStartScript()
  const stop = useStopRun()
  const restart = useRestartRun()
  const busy = start.isPending || stop.isPending || restart.isPending
  const active = run && run.status !== 'exited'

  return (
    <div className="flex shrink-0 items-center gap-2">
      {run && <RunStatusBadge run={run} />}
      {active ? (
        <>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={busy || run.status === 'stopping'}
            onClick={() => restart.mutate(run.id, { onError, onSuccess: onStarted })}
            title="重启"
            aria-label={`重启 ${scriptName}`}
          >
            <RotateCw />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={busy || run.status === 'stopping'}
            onClick={() => stop.mutate(run.id, { onError })}
            title="停止（结束整个进程树）"
            aria-label={`停止 ${scriptName}`}
          >
            {run.status === 'stopping' ? <Loader2 className="animate-spin" /> : <Square />}
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="icon-sm"
          disabled={busy}
          onClick={() => start.mutate({ projectId, scriptId }, { onError, onSuccess: onStarted })}
          title="运行"
          aria-label={`运行 ${scriptName}`}
        >
          {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
        </Button>
      )}
    </div>
  )
}

function RunStatusBadge({ run }: { run: Run }): React.JSX.Element {
  if (run.status === 'running') return <Badge>运行中</Badge>
  if (run.status === 'stopping') return <Badge variant="secondary">停止中</Badge>
  if (run.stopped) return <Badge variant="outline">已停止</Badge>
  if (run.exitCode === 0) return <Badge variant="outline">已完成</Badge>
  return (
    <Badge variant="destructive" title="进程以非零退出码结束">
      退出码 {run.exitCode ?? '未知'}
    </Badge>
  )
}
