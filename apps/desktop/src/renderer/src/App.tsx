import { useState } from 'react'
import { ProjectDetail } from '@renderer/features/projects/project-detail'
import { GroupDetail } from '@renderer/features/groups/group-detail'
import { useGroups, useGroupEventsSync } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'
import { OrphansBanner } from '@renderer/features/runs/orphans-banner'
import { useRunEventsSync } from '@renderer/features/runs/use-runs'
import { SettingsPage } from '@renderer/features/settings/settings-page'
import { Sidebar } from '@renderer/features/sidebar/sidebar'
import { TitleBar } from '@renderer/features/title-bar/title-bar'
import { useWorkspaceEventsSync } from '@renderer/features/workspaces/use-workspaces'

function App(): React.JSX.Element {
  useRunEventsSync()
  useGroupEventsSync()
  useWorkspaceEventsSync()
  const { data: projects } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  const groups = useGroups().data ?? []
  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  // Choosing a project in the sidebar leaves the settings page.
  const selectProject = (projectId: string): void => {
    setSelectedId(projectId)
    setSelectedGroupId(null)
    setRequestedRunId(null)
    setShowSettings(false)
  }

  // Derived rather than synced: falls back to the first project when nothing is selected
  // or the selected one was removed.
  const selected = projects?.find((project) => project.id === selectedId) ?? projects?.[0]

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TitleBar
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r p-3">
          <Sidebar
            selectedGroupId={showSettings ? null : selectedGroupId}
            onSelectGroup={(groupId) => {
              setSelectedGroupId(groupId)
              setShowSettings(false)
            }}
            selectedProjectId={showSettings || selectedGroup ? null : (selected?.id ?? null)}
            currentProjectId={selected?.id ?? null}
            onSelectProject={selectProject}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <OrphansBanner />
          <div className="min-h-0 flex-1">
            {showSettings ? (
              <SettingsPage onClose={() => setShowSettings(false)} />
            ) : selectedGroup ? (
              <GroupDetail
                key={selectedGroup.id}
                group={selectedGroup}
                onOpenRun={(run) => {
                  selectProject(run.projectId)
                  setRequestedRunId(run.id)
                }}
              />
            ) : selected ? (
              <ProjectDetail
                key={`${selected.id}:${requestedRunId ?? ''}`}
                project={selected}
                initialRunId={requestedRunId}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                添加一个项目后，这里会列出它的脚本
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
