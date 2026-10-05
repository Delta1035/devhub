import type { Project, Run, ScriptSource, WorkspaceView } from '@devhub/shared'
import { sourceLabels } from '@renderer/features/scripts/source-labels'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { relativeToWorkspace } from '@renderer/features/workspaces/workspace-display'

interface ProjectSummaryProps {
  project: Project
  /** The workspace that discovered the project; absent for projects added by hand. */
  workspace?: WorkspaceView
  activeRuns: Run[]
}

/** Facts about a project at a glance: shown on hover and in the details dialog. */
export function ProjectSummary({
  project,
  workspace,
  activeRuns
}: ProjectSummaryProps): React.JSX.Element {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <Field label="名称">
        <span className="font-medium text-foreground">{project.name}</span>
      </Field>
      <Field label="路径">
        <span className="break-all">{project.path}</span>
      </Field>
      <Field label="来源">
        {workspace
          ? `工作区「${workspace.name}」/ ${relativeToWorkspace(project.path, workspace)}`
          : '手动添加'}
      </Field>
      <Field label="添加于">{formatDate(project.addedAt)}</Field>
      <Field label="脚本">
        <ScriptCounts projectId={project.id} />
      </Field>
      <Field label="活动终端">
        {activeRuns.length === 0 ? '无' : activeRuns.map((run) => run.title).join('、')}
      </Field>
    </dl>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

/** Shares the script list's query, so it is usually cached already. */
function ScriptCounts({ projectId }: { projectId: string }): React.JSX.Element {
  const scripts = useProjectScripts(projectId)
  if (scripts.isPending) return <span className="text-muted-foreground">扫描中…</span>
  if (scripts.isError) return <span className="text-destructive">{scripts.error.message}</span>
  if (scripts.data.status === 'missing') return <span className="text-destructive">目录不存在</span>
  if (scripts.data.scripts.length === 0) return <span>未识别到脚本</span>

  const counts = new Map<ScriptSource, number>()
  for (const script of scripts.data.scripts) {
    counts.set(script.source, (counts.get(script.source) ?? 0) + 1)
  }
  const parts = [...counts].map(([source, count]) => `${sourceLabels[source]} ${count}`)
  return (
    <span>
      {scripts.data.scripts.length} 个（{parts.join(' · ')}）
      {scripts.data.warnings.length > 0 && (
        <span className="text-warning">，{scripts.data.warnings.length} 条警告</span>
      )}
    </span>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}
