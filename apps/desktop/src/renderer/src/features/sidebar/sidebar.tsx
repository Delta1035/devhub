import { useState } from 'react'
import type { Run } from '@devhub/shared'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { GroupList } from '@renderer/features/groups/group-list'
import { RunningGroupsBar } from '@renderer/features/groups/running-groups-bar'
import { describeActiveGroups, useActiveGroups } from '@renderer/features/groups/use-active-groups'
import { ProjectList } from '@renderer/features/projects/project-list'
import { cn } from '@renderer/lib/utils'

type SidebarTab = 'projects' | 'groups'

const tabKey = 'devhub.sidebarTab'

interface SidebarProps {
  selectedGroupId: string | null
  onSelectGroup: (groupId: string) => void
  /** Highlighted project; null while the settings page is open. */
  selectedProjectId: string | null
  /** Project new groups start from. */
  currentProjectId: string | null
  onSelectProject: (projectId: string) => void
  /** Selects the run's project and shows its terminal tab. */
  onOpenRun: (run: Run) => void
}

/** Projects and batch groups share the sidebar as tabs, so each gets the full height. */
export function Sidebar({
  selectedGroupId,
  onSelectGroup,
  selectedProjectId,
  currentProjectId,
  onSelectProject,
  onOpenRun
}: SidebarProps): React.JSX.Element {
  const [tab, setTab] = useState<SidebarTab>(() =>
    localStorage.getItem(tabKey) === 'groups' ? 'groups' : 'projects'
  )
  const activeGroups = useActiveGroups()

  const changeTab = (value: string): void => {
    const next: SidebarTab = value === 'groups' ? 'groups' : 'projects'
    setTab(next)
    localStorage.setItem(tabKey, next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Above the tabs, so active groups stay visible while browsing projects. */}
      <RunningGroupsBar
        groups={activeGroups}
        onSelectGroup={(groupId) => {
          changeTab('groups')
          onSelectGroup(groupId)
        }}
      />
      <Tabs value={tab} onValueChange={changeTab} className="min-h-0 flex-1 gap-3">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="projects">项目</TabsTrigger>
          <TabsTrigger value="groups">
            批量
            {activeGroups.length > 0 && (
              <span
                role="status"
                aria-label={`正在运行：${describeActiveGroups(activeGroups)}`}
                title={`正在运行：${describeActiveGroups(activeGroups)}`}
                className={cn(
                  'size-1.5 rounded-full',
                  activeGroups.some((group) => group.phase === 'starting')
                    ? 'animate-pulse bg-info'
                    : 'bg-success'
                )}
              />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="min-h-0 overflow-y-auto">
          <ProjectList
            selectedId={selectedProjectId}
            onSelect={onSelectProject}
            onOpenRun={onOpenRun}
          />
        </TabsContent>
        <TabsContent value="groups" className="min-h-0 overflow-y-auto">
          <GroupList
            selectedGroupId={selectedGroupId}
            onSelectGroup={onSelectGroup}
            selectedProjectId={currentProjectId}
            onSelectProject={onSelectProject}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
