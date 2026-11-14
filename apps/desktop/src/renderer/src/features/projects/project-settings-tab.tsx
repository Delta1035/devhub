import { FileCode, Folder, Settings } from 'lucide-react'
import type { Project, Script } from '@devhub/shared'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'

interface ProjectSettingsTabProps {
  project: Project
  scripts: Script[]
}

export function ProjectSettingsTab({
  project,
  scripts
}: ProjectSettingsTabProps): React.JSX.Element {
  const customScripts = scripts.filter((s) => s.source === 'custom')

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      <header className="flex items-center gap-2">
        <Settings className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">项目设置与配置</h3>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-4">
        <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          基本信息
        </h4>
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">项目名称</span>
            <p className="mt-1 font-medium text-foreground">{project.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">识别脚本数</span>
            <p className="mt-1 font-medium text-foreground">{scripts.length} 个</p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">本地文件路径</span>
            <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 font-mono text-[11px]">
              <span className="truncate">{project.path}</span>
              {shell && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void shell?.openProjectFolder(project.id)}
                  className="h-6 shrink-0 gap-1 px-2 text-xs"
                >
                  <Folder className="size-3" />
                  在资源管理器中打开
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="size-4 text-primary" />
            <h4 className="text-xs font-semibold text-foreground">.devhub.yaml 配置文件</h4>
          </div>
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {customScripts.length > 0
              ? `已配置 ${customScripts.length} 个脚本`
              : '未发现自定义配置'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          在项目根目录创建 <code>.devhub.yaml</code>
          ，可自定义启动命令、工作目录、端口检查以及就绪健康检查路径。该配置文件可提交至版本控制供团队共享。
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-[11px] text-foreground/90">
          {`# 示例 .devhub.yaml
scripts:
  dev:
    command: pnpm run dev
    port: 5173
    health: /
  api:
    command: mvnw spring-boot:run
    port: 8080
    health: /actuator/health`}
        </pre>
      </section>
    </div>
  )
}
