import { useState } from 'react'
import { Activity, ExternalLink, Globe, ShieldAlert, Sparkles } from 'lucide-react'
import type { Project, Script } from '@devhub/shared'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { toast } from '@renderer/lib/toast'

interface ProjectSettingsPortsProps {
  project: Project
  scripts: Script[]
}

export function ProjectSettingsPorts({
  project,
  scripts
}: ProjectSettingsPortsProps): React.JSX.Element {
  const [conflictPolicy, setConflictPolicy] = useState<'terminate' | 'error'>('terminate')

  const portItems = scripts.flatMap((s) =>
    (s.ports ?? []).map((port) => ({
      scriptName: s.name,
      command: s.command,
      port,
      healthPath: s.healthPath
    }))
  )

  const handleOpenPort = (port: number): void => {
    window.open(`http://localhost:${port}`, '_blank')
    toast.info(`正在打开 http://localhost:${port}`)
  }

  return (
    <div className="space-y-6">
      {/* Port Overview Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">项目端口映射</h4>
            <p className="text-xs text-muted-foreground">
              「{project.name}」项目脚本声明或自动推断的监听端口列表。
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            已分配 {portItems.length} 个端口
          </Badge>
        </div>

        {portItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
            当前项目脚本暂未声明端口配置。可在 .devhub.yaml 中为脚本指定{' '}
            <code className="font-mono">port: 8080</code>。
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card/60">
            {portItems.map((item) => (
              <div
                key={`${item.scriptName}:${item.port}`}
                className="flex items-center justify-between p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                    <Globe className="size-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {item.scriptName}
                      </span>
                      <span className="rounded bg-info/15 px-1.5 py-0.2 font-mono text-[11px] font-semibold text-info">
                        :{item.port}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground truncate">
                      {item.command}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPort(item.port)}
                    className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                    访问 localhost:{item.port}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Port Conflict Policy */}
      <section className="space-y-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">端口冲突处理策略</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setConflictPolicy('terminate')
              toast.success('已切换为：自动停止占用进程')
            }}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-colors',
              conflictPolicy === 'terminate'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card/60 hover:bg-secondary/40'
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                终止占用进程 (terminate)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              启动时若端口被其他残留进程占用，自动结束旧进程整棵树并释放端口，无需手动杀进程。
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setConflictPolicy('error')
              toast.success('已切换为：冲突时报错提示')
            }}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left transition-colors',
              conflictPolicy === 'error'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card/60 hover:bg-secondary/40'
            )}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning" />
              <span className="text-xs font-semibold text-foreground">报错并提示 (error)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              启动前检测到端口占用时先弹出提示，交由用户手动决定是否强行启动或关闭占用程序。
            </p>
          </button>
        </div>
      </section>

      {/* Health Check Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-heading text-sm font-semibold text-foreground">健康检查配置</h4>
          <span className="text-[11px] text-muted-foreground">ADR 0011 规范</span>
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-4 space-y-2.5 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Activity className="size-4 text-primary" />
            HTTP 连通与就绪检测
          </div>
          <p>
            可在 <code className="font-mono text-foreground">.devhub.yaml</code>{' '}
            中为后端服务配置健康检查路径。服务返回 2xx 响应即标志为完全就绪（Ready）：
          </p>
          <pre className="overflow-x-auto rounded border border-border bg-[#08090C] p-2.5 font-mono text-[11px] text-[#7FB2FF]">
            {`scripts:
  dev:
    command: pnpm run dev
    port: 5173
    health: /healthz`}
          </pre>
        </div>
      </section>
    </div>
  )
}
