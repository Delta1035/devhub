import {
  Copy,
  ExternalLink,
  FileCode,
  FlaskConical,
  Layers,
  MoreHorizontal,
  Package,
  Play,
  ShieldCheck
} from 'lucide-react'
import type { Run, Script, ScriptSource } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import type { ActiveGroupView } from '@renderer/features/groups/use-active-groups'
import { RunControls } from '@renderer/features/runs/run-controls'
import { RunHistoryButton } from '@renderer/features/runs/run-history-button'
import { toast } from '@renderer/lib/toast'
import { sourceLabels } from './source-labels'

function ScriptIcon({
  scriptName,
  className
}: {
  scriptName: string
  className?: string
}): React.JSX.Element {
  const name = scriptName.toLowerCase()
  if (/dev|start|serve/.test(name)) return <Play className={className} />
  if (/build|compile|package|dist/.test(name)) return <Package className={className} />
  if (/test|check|verify|spec/.test(name)) return <FlaskConical className={className} />
  if (/lint|format|style/.test(name)) return <ShieldCheck className={className} />
  return <Layers className={className} />
}

export interface ScriptGroupProps {
  projectId: string
  source: ScriptSource
  scripts: Script[]
  runs: Run[]
  /** Labels scripts that a batch run started or reused. */
  activeGroups: ActiveGroupView[]
  onRunError: (error: Error, retry?: () => void) => void
  onRunStarted: (run: Run) => void
  onOpenSettings?: () => void
}

export function ScriptGroup({
  projectId,
  source,
  scripts,
  runs,
  activeGroups,
  onRunError,
  onRunStarted,
  onOpenSettings
}: ScriptGroupProps): React.JSX.Element {
  // All scripts of one source share the executable, e.g. "pnpm" or "mvnw.cmd".
  const executable = scripts[0]?.command.split(' ')[0]

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {sourceLabels[source]}
        {executable && (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {executable}
          </Badge>
        )}
      </h3>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/80 bg-card overflow-hidden">
        {scripts.map((script) => {
          const run = runs.find(
            (candidate) =>
              candidate.kind === 'script' &&
              candidate.projectId === projectId &&
              candidate.scriptId === script.id
          )
          const groups = run ? activeGroups.filter((group) => group.runIds.includes(run.id)) : []
          return (
            <li
              key={script.id}
              className="group flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/30 max-md:gap-2 max-md:px-3"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
                <ScriptIcon scriptName={script.name} className="size-3.5" />
              </div>

              {/* On phones the name goes above the command, leaving the row's width to the controls. */}
              <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-4">
                <span className="flex min-w-0 items-center gap-1.5 md:w-36 md:shrink-0">
                  <span className="truncate font-medium text-xs md:text-sm" title={script.name}>
                    {script.name}
                  </span>
                  {groups.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-4 min-w-0 shrink px-1.5 text-[10px] text-info"
                      title={`由批量任务启动或纳入：${groups.map((group) => group.name).join('、')}`}
                    >
                      <span className="truncate">
                        批量：{groups.map((group) => group.name).join('、')}
                      </span>
                    </Badge>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <code
                      className="truncate font-mono text-xs text-foreground/80"
                      title={script.command}
                    >
                      {script.command}
                    </code>
                    {script.ports?.map((port) => (
                      <button
                        key={port}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`http://localhost:${port}`, '_blank')
                          toast.info(`正在打开 http://localhost:${port}`)
                        }}
                        className="h-4 shrink-0 px-1.5 font-mono text-[10px] text-info border border-info/30 bg-info/10 hover:bg-info/20 hover:border-info/50 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title={`点击访问 http://localhost:${port}`}
                      >
                        端口 {port}
                        <ExternalLink className="size-2.5 opacity-70" />
                      </button>
                    ))}
                  </span>
                  {script.description && (
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={script.description}
                    >
                      {script.description}
                    </p>
                  )}
                </div>
              </div>
              <RunHistoryButton
                projectId={projectId}
                scriptId={script.id}
                scriptName={script.name}
              />
              <RunControls
                projectId={projectId}
                scriptId={script.id}
                scriptName={script.name}
                run={run}
                onError={onRunError}
                onStarted={onRunStarted}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="更多脚本操作"
                    title="更多操作"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard
                        .writeText(script.command)
                        .then(() => toast.success('已复制启动命令'))
                        .catch(() => toast.info(`命令: ${script.command}`))
                    }}
                  >
                    <Copy className="size-3.5 mr-1.5" />
                    复制启动命令
                  </DropdownMenuItem>
                  {onOpenSettings && (
                    <DropdownMenuItem onClick={onOpenSettings}>
                      <FileCode className="size-3.5 mr-1.5" />
                      编辑配置
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
