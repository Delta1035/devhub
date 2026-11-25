import { useCallback, useState } from 'react'
import type { Project, Run } from '@devhub/shared'
import { useResizableWidth } from '@renderer/features/sidebar/use-resizable-width'
import { cn } from '@renderer/lib/utils'
import { ProjectDetail } from './project-detail'
import { ProjectList } from './project-list'

interface ProjectWorkspaceProps {
  narrow: boolean
  selectedProject: Project | undefined
  requestedRunId: string | null
  onSelectProject: (projectId: string) => void
  onOpenRun: (run: Run) => void
}

/** Keeps project discovery beside the selected project's detail without mixing feature navigation into it. */
export function ProjectWorkspace({
  narrow,
  selectedProject,
  requestedRunId,
  onSelectProject,
  onOpenRun
}: ProjectWorkspaceProps): React.JSX.Element {
  const projectList = useResizableWidth('devhub.projectListWidth', 260, 200, 'devhub.sidebarWidth')
  const [terminalView, setTerminalView] = useState(false)
  const handleTerminalViewChange = useCallback((active: boolean) => setTerminalView(active), [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-6 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">
            项目
          </h1>
          <p className="text-xs text-muted-foreground">选择项目查看脚本、终端与运行历史</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <section
          aria-label="项目列表"
          style={narrow ? undefined : { width: projectList.width }}
          className={cn(
            'relative flex min-h-[13rem] w-full shrink-0 flex-col border-b border-border bg-card/40 sm:min-h-0 sm:border-b-0 sm:border-r',
            // On a phone the terminal tab needs the whole height; the list returns on other tabs.
            narrow && terminalView && 'hidden'
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
            <ProjectList
              narrow={narrow}
              selectedId={selectedProject?.id ?? null}
              onSelect={onSelectProject}
              onOpenRun={onOpenRun}
            />
          </div>
          {!narrow && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="调整项目列表宽度"
              aria-valuenow={projectList.width}
              tabIndex={0}
              title="拖动调整宽度，双击恢复默认"
              {...projectList.handleProps}
              className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition-colors hover:after:bg-primary/50 focus-visible:after:bg-primary"
            />
          )}
        </section>
        <section aria-label="项目内容" className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {selectedProject ? (
            <ProjectDetail
              key={`${selectedProject.id}:${requestedRunId ?? ''}`}
              project={selectedProject}
              initialRunId={requestedRunId}
              onTerminalViewChange={handleTerminalViewChange}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
              添加一个项目后，这里会列出它的脚本
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
