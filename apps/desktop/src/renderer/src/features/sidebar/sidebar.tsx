import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { GroupList } from '@renderer/features/groups/group-list'
import { useGroupStates } from '@renderer/features/groups/use-groups'
import { ProjectList } from '@renderer/features/projects/project-list'

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
}

/** Projects and batch groups share the sidebar as tabs, so each gets the full height. */
export function Sidebar({
  selectedGroupId,
  onSelectGroup,
  selectedProjectId,
  currentProjectId,
  onSelectProject
}: SidebarProps): React.JSX.Element {
  const [tab, setTab] = useState<SidebarTab>(() =>
    localStorage.getItem(tabKey) === 'groups' ? 'groups' : 'projects'
  )
  // Hidden behind the projects tab, a running group would otherwise go unnoticed.
  const groupRunning = (useGroupStates().data ?? []).some((state) => state.status === 'running')

  const changeTab = (value: string): void => {
    const next: SidebarTab = value === 'groups' ? 'groups' : 'projects'
    setTab(next)
    localStorage.setItem(tabKey, next)
  }

  return (
    <Tabs value={tab} onValueChange={changeTab} className="min-h-0 flex-1 gap-3">
      <TabsList className="w-full shrink-0">
        <TabsTrigger value="projects">项目</TabsTrigger>
        <TabsTrigger value="groups">
          批量
          {groupRunning && (
            <span
              role="status"
              aria-label="有批量任务执行中"
              className="size-1.5 animate-pulse rounded-full bg-info"
            />
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="projects" className="min-h-0 overflow-y-auto">
        <ProjectList selectedId={selectedProjectId} onSelect={onSelectProject} />
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
  )
}
