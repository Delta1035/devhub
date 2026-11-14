import { ArrowRight, Play, Plus, Workflow } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { useGroups, useStartGroup } from '@renderer/features/groups/use-groups'
import { toast } from '@renderer/lib/toast'

interface ProjectSettingsGroupsProps {
  project: Project
  onSwitchToBatch?: () => void
}

export function ProjectSettingsGroups({
  project,
  onSwitchToBatch
}: ProjectSettingsGroupsProps): React.JSX.Element {
  const groups = useGroups().data ?? []
  const startGroup = useStartGroup()

  const projectGroups = groups.filter((g) => g.steps.some((s) => s.projectId === project.id))

  const handleStartGroup = (groupId: string, name: string): void => {
    startGroup.mutate(groupId, {
      onSuccess: () => {
        toast.success(`已触发批量任务：${name}`)
      },
      onError: (e) => {
        toast.error(`启动任务失败：${e.message}`)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">关联批量任务</h4>
            <p className="text-xs text-muted-foreground">
              包含「{project.name}」脚本的组合编排任务。可在左侧底部批量任务中心进行编排。
            </p>
          </div>
          {onSwitchToBatch && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSwitchToBatch}
              className="h-8 gap-1.5 border-border bg-secondary/60 text-xs text-muted-foreground hover:text-foreground"
            >
              <Workflow className="size-3.5" />
              前往任务中心
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      </section>

      {/* Task List */}
      <section className="space-y-3">
        {projectGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-dashed border-border/80">
            <Workflow className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground mb-3">暂无包含此项目脚本的批量任务</p>
            {onSwitchToBatch && (
              <Button
                size="sm"
                onClick={onSwitchToBatch}
                className="h-8 gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-3.5" />
                新建批量任务
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card/60">
            {projectGroups.map((g) => {
              const mySteps = g.steps.filter((s) => s.projectId === project.id)
              return (
                <div key={g.id} className="flex items-center justify-between p-3.5">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{g.name}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {g.mode === 'parallel' ? '并行运行' : '串行流水线'}
                      </Badge>
                      {g.pinnedAt && (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-primary border-primary/30"
                        >
                          已置顶
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground truncate">
                      共 {g.steps.length} 个步骤（包含本项目 {mySteps.length} 个步骤：
                      {mySteps.map((s) => s.scriptId).join('、')}）
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleStartGroup(g.id, g.name)}
                      disabled={startGroup.isPending}
                      className="h-7 gap-1 px-2.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                    >
                      <Play className="size-3" />
                      启动此任务
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
