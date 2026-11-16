import type { Project, Run } from '@devhub/shared'
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
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div>
          <h1 className="font-heading text-base font-semibold text-foreground">项目</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">选择项目查看脚本、终端与运行历史</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col min-[400px]:flex-row">
        <section
          aria-label="项目列表"
          className="min-h-[13rem] w-full shrink-0 overflow-y-auto border-b border-border p-4 min-[400px]:min-h-0 min-[400px]:w-[18rem] min-[400px]:border-b-0 min-[400px]:border-r md:p-5"
        >
          <ProjectList
            narrow={narrow}
            selectedId={selectedProject?.id ?? null}
            onSelect={onSelectProject}
            onOpenRun={onOpenRun}
          />
        </section>
        <section aria-label="项目内容" className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {selectedProject ? (
            <ProjectDetail
              key={`${selectedProject.id}:${requestedRunId ?? ''}`}
              project={selectedProject}
              initialRunId={requestedRunId}
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
