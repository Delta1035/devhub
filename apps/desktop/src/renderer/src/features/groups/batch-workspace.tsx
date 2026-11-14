import { useState } from 'react'
import { Layers, Plus } from 'lucide-react'
import type { Group, Run } from '@devhub/shared'
import { access } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { BatchHeader } from './batch-header'
import { BatchTaskList } from './batch-task-list'
import { GroupDetail } from './group-detail'
import { GroupEditor } from './group-editor'
import { useGroups } from './use-groups'

interface BatchWorkspaceProps {
  selectedGroupId: string | null
  onSelectGroup: (groupId: string) => void
  onOpenRun: (run: Run) => void
}

export function BatchWorkspace({
  selectedGroupId,
  onSelectGroup,
  onOpenRun
}: BatchWorkspaceProps): React.JSX.Element {
  const groups = useGroups().data ?? []
  const [editingGroup, setEditingGroup] = useState<Group | null | undefined>(undefined)

  // Default to the first group if none selected
  const activeGroupId = selectedGroupId ?? groups[0]?.id ?? null
  const selectedGroup = groups.find((g) => g.id === activeGroupId)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 批量任务主头部 */}
      <BatchHeader onNewGroup={() => setEditingGroup(null)} />

      {/* 两栏主体：左侧任务列表 + 右侧详情 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左栏：批量任务列表 (272px) */}
        <BatchTaskList
          selectedGroupId={activeGroupId}
          onSelectGroup={onSelectGroup}
          onNewGroup={() => setEditingGroup(null)}
          onEditGroup={(group) => setEditingGroup(group)}
        />

        {/* 右栏：任务运行详情 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedGroup ? (
            <GroupDetail key={selectedGroup.id} group={selectedGroup} onOpenRun={onOpenRun} />
          ) : groups.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card/60 text-muted-foreground shadow-xs">
                <Layers className="size-6" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">暂无批量任务</h3>
                <p className="max-w-xs text-xs text-muted-foreground">
                  把多个项目的脚本组合起来，一键并行或按顺序启动。
                </p>
              </div>
              {access.manage && (
                <Button
                  size="sm"
                  onClick={() => setEditingGroup(null)}
                  className="gap-1.5 bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-3.5" data-icon="inline-start" />
                  新建第一个任务
                </Button>
              )}
            </div>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              请从左侧选择一个批量任务查看详情
            </p>
          )}
        </div>
      </div>

      {/* 编辑/新建弹窗 */}
      {editingGroup !== undefined && (
        <GroupEditor group={editingGroup} onClose={() => setEditingGroup(undefined)} />
      )}
    </div>
  )
}
