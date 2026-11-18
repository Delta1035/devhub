import { useState, useEffect } from 'react'
import { Copy, QrCode, Smartphone, Wifi } from 'lucide-react'
import type { Project, RemoteState } from '@devhub/shared'
import { api } from '@renderer/api'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { ToggleSwitch } from './project-settings-editor'
import { toast } from '@renderer/lib/toast'

interface ProjectSettingsRemoteProps {
  project: Project
}

export function ProjectSettingsRemote({ project }: ProjectSettingsRemoteProps): React.JSX.Element {
  const [remoteState, setRemoteState] = useState<RemoteState | null>(null)
  const [allowRemoteControl, setAllowRemoteControl] = useState(true)

  useEffect(() => {
    api
      .getRemoteState()
      .then(setRemoteState)
      .catch(() => undefined)
  }, [])

  const handleCopyToken = async (): Promise<void> => {
    if (!remoteState?.token) return
    try {
      await navigator.clipboard.writeText(remoteState.token)
      toast.success('远程连接口令已复制')
    } catch {
      toast.info(`口令: ${remoteState.token}`)
    }
  }

  const handleCopyUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('远程地址已复制')
    } catch {
      toast.info(`地址: ${url}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Remote Status */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">远程管理状态</h4>
            <p className="text-xs text-muted-foreground">
              通过手机 App（Android / iOS）在局域网内直接管理与控制 DevHub。
            </p>
          </div>
          <Badge
            variant="outline"
            className="gap-1 border-primary/30 bg-primary/10 text-primary text-xs"
          >
            <Wifi className="size-3" />
            {remoteState?.enabled ? '服务运行中' : '远程服务未开启'}
          </Badge>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-card/60">
          <div className="flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-medium text-foreground">监听端口</span>
            <span className="font-mono text-xs text-foreground/90">
              :{remoteState?.port ?? 9876}
            </span>
          </div>

          <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">访问地址</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                http://127.0.0.1:{remoteState?.port ?? 9876}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyUrl(`http://127.0.0.1:${remoteState?.port ?? 9876}`)}
              className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <Copy className="size-3" />
              复制地址
            </Button>
          </div>

          <div className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">连接口令 (Token)</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {remoteState?.token ?? 'devhub-demo-token'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCopyToken()}
              className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              <Copy className="size-3" />
              复制代码
            </Button>
          </div>
        </div>
      </section>

      {/* Permissions */}
      <section className="space-y-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">权限与控制策略</h4>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">
              允许远程设备启停「{project.name}」脚本
            </span>
            <span className="text-[11px] text-muted-foreground">
              开启后，已配对的移动端设备可以一键启动或停止该项目的任务
            </span>
          </div>
          <ToggleSwitch
            checked={allowRemoteControl}
            onCheckedChange={setAllowRemoteControl}
            aria-label="允许远程设备启停本项目脚本"
          />
        </div>
      </section>

      {/* App Guide Card */}
      <section className="space-y-3">
        <div className="rounded-lg border border-border bg-card/60 p-4 flex items-start gap-3.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Smartphone className="size-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h5 className="font-semibold text-foreground flex items-center gap-2">
              手机端扫码直连
              <QrCode className="size-3.5 text-muted-foreground" />
            </h5>
            <p className="text-muted-foreground leading-relaxed">
              在手机上打开 DevHub Android
              客户端，扫码或输入口令即可自动配对，在手机上实时查看终端日志输出。
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
