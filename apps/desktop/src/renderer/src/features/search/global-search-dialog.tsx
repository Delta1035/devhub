import { useEffect, useState } from 'react'
import { Folder, Search, Workflow } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useGroups } from '@renderer/features/groups/use-groups'
import { useProjects } from '@renderer/features/projects/use-projects'

interface GlobalSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProject: (projectId: string) => void
  onSelectGroup: (groupId: string) => void
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
  onSelectProject,
  onSelectGroup
}: GlobalSearchDialogProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const projects = useProjects().data ?? []
  const groups = useGroups().data ?? []

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.path.toLowerCase().includes(query.toLowerCase())
  )

  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl p-0 overflow-hidden border-border bg-[#111419] text-[#E8ECF2] shadow-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>全局搜索</DialogTitle>
          <DialogDescription>搜索本地项目、批量任务与脚本</DialogDescription>
        </DialogHeader>

        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#212731] bg-[#171C23] px-4 py-3">
          <Search className="size-4 shrink-0 text-[#8B95A6]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目、脚本或运行记录..."
            className="flex-1 bg-transparent text-sm text-[#E8ECF2] placeholder:text-[#6F7A8B] outline-none"
            autoFocus
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
            title="关闭 (Esc)"
            className="cursor-pointer select-none rounded border border-[#2D3541] bg-[#111419] px-2 py-0.5 font-mono text-[10px] text-[#8B95A6] transition-colors hover:border-[#3D4554] hover:text-[#CCD2DC]"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {/* Projects Section */}
          {filteredProjects.length > 0 && (
            <div className="mb-3">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#6F7A8B]">
                项目 ({filteredProjects.length})
              </span>
              <ul className="mt-1 flex flex-col gap-1">
                {filteredProjects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(p.id)
                        onOpenChange(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-xs text-[#E8ECF2] transition-colors hover:bg-[#1A2028]"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-[#171C23] text-[#7FB2FF]">
                        <Folder className="size-3.5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium text-[#E8ECF2]">{p.name}</span>
                        <span className="truncate font-mono text-[10px] text-[#6F7A8B]">
                          {p.path}
                        </span>
                      </div>
                      <span className="rounded bg-[#171C23] px-1.5 py-0.5 text-[10px] text-[#8B95A6]">
                        打开
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Batch Tasks Section */}
          {filteredGroups.length > 0 && (
            <div className="mb-3">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#6F7A8B]">
                批量任务 ({filteredGroups.length})
              </span>
              <ul className="mt-1 flex flex-col gap-1">
                {filteredGroups.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectGroup(g.id)
                        onOpenChange(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-xs text-[#E8ECF2] transition-colors hover:bg-[#1A2028]"
                    >
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-[#171C23] text-[#3ED598]">
                        <Workflow className="size-3.5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium text-[#E8ECF2]">{g.name}</span>
                        <span className="text-[10px] text-[#6F7A8B]">
                          {g.steps.length} 个步骤 ·{' '}
                          {g.mode === 'parallel' ? '并行启动' : '串行流水线'}
                        </span>
                      </div>
                      <span className="rounded bg-[#171C23] px-1.5 py-0.5 text-[10px] text-[#8B95A6]">
                        运行
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filteredProjects.length === 0 && filteredGroups.length === 0 && (
            <div className="py-8 text-center text-xs text-[#6F7A8B]">
              未找到匹配的项目或批量任务
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
