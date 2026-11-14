import { useState } from 'react'
import { ChevronRight, FileCode, FolderX, TriangleAlert, X } from 'lucide-react'
import type { Project, Run, Script, ScriptSource } from '@devhub/shared'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useActiveGroups } from '@renderer/features/groups/use-active-groups'
import { useRuns } from '@renderer/features/runs/use-runs'
import { ScriptGroup } from './script-group'
import { sourceLabels } from './source-labels'
import { useProjectScripts } from './use-scripts'

interface ScriptListProps {
  project: Project
  filterQuery?: string
  /** Called with a freshly started run so the terminal panel can switch to it. */
  onRunStarted: (run: Run) => void
  onOpenSettings?: () => void
}

export function ScriptList({
  project,
  filterQuery = '',
  onRunStarted,
  onOpenSettings
}: ScriptListProps): React.JSX.Element {
  const scripts = useProjectScripts(project.id)
  const runs = useRuns()
  const activeGroups = useActiveGroups()
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

  const query = filterQuery.trim().toLowerCase()
  const displayItems = query
    ? items.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.command.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query))
      )
    : items

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
        <p className="rounded-lg border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
          没有识别到脚本。目前支持 package.json（npm / pnpm / yarn）、pom.xml（Maven）、
          build.gradle（Gradle），以及项目根目录的 .devhub.yaml（自定义脚本）。
        </p>
      )}

      {displayItems.length === 0 && items.length > 0 && (
        <p className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          没有匹配「{filterQuery}」的脚本
        </p>
      )}

      {groupBySource(displayItems).map(([source, group]) => (
        <ScriptGroup
          key={source}
          projectId={project.id}
          source={source}
          scripts={group}
          runs={runs.data ?? []}
          activeGroups={activeGroups}
          onRunError={(error, retry) => setRunError({ error, retry })}
          onRunStarted={onRunStarted}
          onOpenSettings={onOpenSettings}
        />
      ))}

      {/* 自定义脚本提示条 (对齐 pen/devhub.pen) */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <FileCode className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            {items.filter((s) => s.source === 'custom').length > 0
              ? `检测到 .devhub.yaml 中的 ${items.filter((s) => s.source === 'custom').length} 个自定义脚本`
              : '检测到 .devhub.yaml 中的 0 个自定义脚本'}
          </span>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-semibold text-primary hover:underline text-xs"
          >
            查看
          </button>
        )}
      </div>

      <ConfigHint />
    </div>
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

const configExample = `scripts:
  api:
    command: mvnw.cmd spring-boot:run -pl server
    description: 后端（server 模块）
    port: 8081
    health: /actuator/health  # 返回 2xx 才算就绪；不写则只检查端口
  compose:
    command: docker compose up
    cwd: deploy
  mock:
    command:            # 按平台区分
      windows: mock.bat
      linux: ./mock.sh`

/** How to add commands no detector finds; collapsed by default. */
function ConfigHint(): React.JSX.Element {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">
        需要其他命令？在项目根目录添加 .devhub.yaml
      </summary>
      <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono">
        {configExample}
      </pre>
      <p className="mt-1">
        cwd 相对于项目目录；port 省略时会从命令推断。保存后点「刷新」或切回 DevHub 即生效。
      </p>
    </details>
  )
}
