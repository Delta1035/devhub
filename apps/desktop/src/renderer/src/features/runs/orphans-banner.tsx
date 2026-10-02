import { TriangleAlert } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@renderer/api'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { useProjects } from '@renderer/features/projects/use-projects'

const orphansKey = ['orphaned-runs'] as const

/**
 * After DevHub crashed or was killed, processes it started may still be running with no way
 * to manage them. Offers to stop them (whole trees) or to leave them alone.
 */
export function OrphansBanner(): React.JSX.Element | null {
  const queryClient = useQueryClient()
  // Checked once per session: new orphans can only appear after another crash.
  const orphans = useQuery({
    queryKey: orphansKey,
    queryFn: () => api.listOrphanedRuns(),
    staleTime: Infinity,
    refetchOnWindowFocus: false
  })
  const projects = useProjects().data ?? []
  const resolve = useMutation({
    mutationFn: (action: 'kill' | 'dismiss') =>
      action === 'kill' ? api.killOrphanedRuns() : api.dismissOrphanedRuns(),
    onSuccess: () => queryClient.setQueryData(orphansKey, [])
  })

  if (!orphans.data || orphans.data.length === 0) return null

  return (
    <Alert className="mx-6 mt-4 w-auto">
      <TriangleAlert />
      <AlertTitle>发现上次未正常退出时遗留的 {orphans.data.length} 个进程</AlertTitle>
      <AlertDescription>
        <p>DevHub 上次没有正常退出，这些进程仍在运行，但已无法在 DevHub 中管理：</p>
        <ul className="my-1 list-disc pl-5">
          {orphans.data.map((orphan) => (
            <li key={orphan.pid}>
              {projects.find((project) => project.id === orphan.projectId)?.name ?? '未知项目'} ·{' '}
              {orphan.title}
              <span className="text-muted-foreground">
                {' '}
                （PID {orphan.pid}，{orphan.command}）
              </span>
            </li>
          ))}
        </ul>
        {resolve.error && <p className="text-destructive">{resolve.error.message}</p>}
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate('kill')}>
            全部结束
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate('dismiss')}
          >
            忽略
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
