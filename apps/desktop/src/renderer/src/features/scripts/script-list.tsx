import { useState } from 'react'
import { FolderX, TriangleAlert, X } from 'lucide-react'
import type { Project, Run, Script, ScriptSource } from '@devhub/shared'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { RunControls } from '@renderer/features/runs/run-controls'
import { useRuns } from '@renderer/features/runs/use-runs'
import { useProjectScripts } from './use-scripts'

const sourceLabels: Record<ScriptSource, string> = {
  npm: 'npm',
  maven: 'Maven',
  gradle: 'Gradle',
  custom: '自定义'
}

interface ScriptListProps {
  project: Project
  /** Called with a freshly started run so the terminal panel can switch to it. */
  onRunStarted: (run: Run) => void
}

export function ScriptList({ project, onRunStarted }: ScriptListProps): React.JSX.Element {
  const scripts = useProjectScripts(project.id)
  const runs = useRuns()
  // `retry` is set for a taken port: the user may start the script anyway.
  const [runError, setRunError] = useState<{ error: Error; retry?: () => void } | null>(null)

  if (scripts.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-12" />
        ))}
      </div>
    )
  }

  if (scripts.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>无法读取脚本</AlertTitle>
        <AlertDescription>{scripts.error.message}</AlertDescription>
      </Alert>
    )
  }

  const { status, scripts: items, warnings } = scripts.data
  if (status === 'missing') {
    return (
      <Alert variant="destructive">
        <FolderX />
        <AlertTitle>项目目录不存在</AlertTitle>
        <AlertDescription>
          {project.path} 已被删除或移动。可以在左侧移除该项目后重新添加。
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {runError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{runError.retry ? '端口已被占用' : '操作失败'}</AlertTitle>
          <AlertDescription>
            <p>{runError.error.message}</p>
            {runError.retry && (
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    runError.retry?.()
                    setRunError(null)
                  }}
                >
                  仍然启动
                </Button>
              </div>
            )}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setRunError(null)}
              aria-label="关闭"
            >
              <X />
            </Button>
          </AlertAction>
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>部分脚本未能识别</AlertTitle>
          <AlertDescription>
            <ul>
              {warnings.map((warning) => (
                <li key={warning.source}>
                  {sourceLabels[warning.source]}：{warning.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {items.length === 0 && warnings.length === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          没有识别到脚本。目前支持 package.json（npm / pnpm / yarn）、pom.xml（Maven）和
          build.gradle（Gradle）。
        </p>
      )}

      {groupBySource(items).map(([source, group]) => (
        <ScriptGroup
          key={source}
          projectId={project.id}
          source={source}
          scripts={group}
          runs={runs.data ?? []}
          onRunError={(error, retry) => setRunError({ error, retry })}
          onRunStarted={onRunStarted}
        />
      ))}
    </div>
  )
}

interface ScriptGroupProps {
  projectId: string
  source: ScriptSource
  scripts: Script[]
  runs: Run[]
  onRunError: (error: Error, retry?: () => void) => void
  onRunStarted: (run: Run) => void
}

function ScriptGroup({
  projectId,
  source,
  scripts,
  runs,
  onRunError,
  onRunStarted
}: ScriptGroupProps): React.JSX.Element {
  // All scripts of one source share the executable, e.g. "pnpm" or "mvnw.cmd".
  const executable = scripts[0]?.command.split(' ')[0]

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {sourceLabels[source]}
        {executable && <Badge variant="secondary">{executable}</Badge>}
      </h3>
      <ul className="divide-y rounded-lg border bg-card">
        {scripts.map((script) => (
          <li key={script.id} className="flex items-center gap-4 px-4 py-2.5">
            <span className="w-40 shrink-0 truncate font-medium" title={script.name}>
              {script.name}
            </span>
            <div className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <code className="truncate font-mono text-xs" title={script.command}>
                  {script.command}
                </code>
                {script.ports?.map((port) => (
                  <Badge
                    key={port}
                    variant="outline"
                    className="h-4 shrink-0 px-1.5 text-[10px]"
                    title="启动前会检查这个端口是否已被占用"
                  >
                    端口 {port}
                  </Badge>
                ))}
              </span>
              {script.description && (
                <p className="truncate text-xs text-muted-foreground" title={script.description}>
                  {script.description}
                </p>
              )}
            </div>
            <RunControls
              projectId={projectId}
              scriptId={script.id}
              scriptName={script.name}
              run={runs.find(
                (run) =>
                  run.kind === 'script' && run.projectId === projectId && run.scriptId === script.id
              )}
              onError={onRunError}
              onStarted={onRunStarted}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Keeps the order the core returned, which is detector order. */
function groupBySource(scripts: Script[]): [ScriptSource, Script[]][] {
  const groups = new Map<ScriptSource, Script[]>()
  for (const script of scripts) {
    const group = groups.get(script.source)
    if (group) group.push(script)
    else groups.set(script.source, [script])
  }
  return [...groups]
}
