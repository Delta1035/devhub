import { useState } from 'react'
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  FileCode,
  Folder,
  Settings,
  Smartphone,
  Variable,
  Workflow
} from 'lucide-react'
import type { Project, Script } from '@devhub/shared'
import { shell } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

function ToggleSwitch({
  checked,
  onCheckedChange,
  'aria-label': ariaLabel
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  'aria-label': string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-accent' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-3.5 rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-4 bg-[#06130D]' : 'translate-x-0.5 bg-muted-foreground'
        )}
      />
    </button>
  )
}

interface ProjectSettingsTabProps {
  project: Project
  scripts: Script[]
}

type SettingsSectionKey = 'general' | 'scripts' | 'ports' | 'env' | 'groups' | 'remote'

export function ProjectSettingsTab({
  project,
  scripts
}: ProjectSettingsTabProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('scripts')
  const [checkPortsOnStart, setCheckPortsOnStart] = useState(true)
  const [autoScrollLogs, setAutoScrollLogs] = useState(true)
  const [duplicatePolicy, setDuplicatePolicy] = useState<'replace' | 'parallel'>('replace')

  const customScripts = scripts.filter((s) => s.source === 'custom')

  const yamlExample = `# 项目级自定义配置 .devhub.yaml
scripts:
  dev:mock:
    command: pnpm run dev:mock
    port: 5174
    env:
      VITE_MOCK: "1"
  db:seed:
    command: node scripts/seed.js
    port: 5432
    health:
      tcp: 5432`

  const navItems = [
    { key: 'general' as const, label: '常规设置', icon: Settings },
    { key: 'scripts' as const, label: '自定义脚本', icon: FileCode, count: customScripts.length },
    { key: 'ports' as const, label: '端口与健康检查', icon: Activity },
    { key: 'env' as const, label: '环境变量', icon: Variable },
    { key: 'groups' as const, label: '批量任务规则', icon: Workflow },
    { key: 'remote' as const, label: '远程访问', icon: Smartphone }
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Settings Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card/40 px-4 py-3 md:px-6 md:py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-semibold text-foreground">项目设置</h3>
            <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
              {project.name}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            配置保存在项目根目录的 <code>.devhub.yaml</code>，可随仓库提交共享。
          </p>
        </div>

        {shell && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void shell?.openProjectFolder(project.id)}
            className="h-8 gap-1.5 border-border text-xs text-foreground hover:bg-secondary"
          >
            <Folder className="size-3.5" />
            在资源管理器中打开
          </Button>
        )}
      </header>

      {/* Split Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left Nav */}
        <aside className="w-52 shrink-0 border-r border-border/80 bg-sidebar p-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'bg-secondary font-medium text-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.2 font-mono text-[10px] text-accent">
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}

          <div className="flex-1" />

          {/* Config file path card */}
          <div className="rounded-lg border border-border/80 bg-card/60 p-2.5 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              配置文件路径
            </span>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
              {project.path}\.devhub.yaml
            </p>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* YAML Editor / Preview Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-heading text-sm font-semibold text-foreground">
                  自定义脚本与配置
                </h4>
                <p className="text-xs text-muted-foreground">
                  补充自动检测无法识别的脚本。在项目根目录下配置后即时生效。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (shell) void shell.openProjectFolder(project.id)
                  }}
                  className="h-7 gap-1 border-border px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3" />
                  在编辑器中编辑
                </Button>
              </div>
            </div>

            {/* Code Box */}
            <div className="overflow-hidden rounded-lg border border-border/80 bg-[#080A0D]">
              <div className="flex items-center gap-2 border-b border-border/80 bg-[#0C0F13] px-3 py-1.5 text-xs text-muted-foreground">
                <FileCode className="size-3.5 text-accent" />
                <span className="font-mono text-[11px] text-foreground font-medium">
                  .devhub.yaml
                </span>
                <span className="rounded bg-secondary/80 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                  只读预览
                </span>
              </div>
              <div className="flex font-mono text-xs p-3">
                <div className="select-none pr-3 text-right text-muted-foreground/40 border-r border-border/40 space-y-0.5">
                  {yamlExample.split('\n').map((_, idx) => (
                    <div key={idx}>{idx + 1}</div>
                  ))}
                </div>
                <pre className="pl-3 overflow-x-auto text-muted-foreground leading-relaxed">
                  <code>{yamlExample}</code>
                </pre>
              </div>
            </div>

            {/* Parsing summary */}
            <div className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent/5 p-3 text-xs text-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-accent" />
              <span>
                解析成功 · 当前项目已识别 {scripts.length} 个脚本（包含 {customScripts.length}{' '}
                个自定义配置脚本）
              </span>
            </div>
          </section>

          {/* Execution Behaviors Section */}
          <section className="space-y-3 pt-2">
            <h4 className="font-heading text-sm font-semibold text-foreground">启动行为</h4>

            <div className="rounded-lg border border-border/80 bg-card divide-y divide-border/60 text-xs">
              {/* Check ports */}
              <div className="flex items-center justify-between gap-4 p-3.5">
                <div>
                  <span className="font-medium text-foreground">启动前检查端口占用</span>
                  <p className="mt-0.5 text-muted-foreground">
                    脚本所需端口被其他进程占用时先提示，并可选择停止占用者并释放端口。
                  </p>
                </div>
                <ToggleSwitch
                  checked={checkPortsOnStart}
                  onCheckedChange={setCheckPortsOnStart}
                  aria-label="启动前检查端口占用"
                />
              </div>

              {/* Duplicate script policy */}
              <div className="flex items-center justify-between gap-4 p-3.5">
                <div>
                  <span className="font-medium text-foreground">重复运行同名脚本时</span>
                  <p className="mt-0.5 text-muted-foreground">
                    决定再次启动同名脚本时是先停止覆盖当前实例，还是并行启动新终端。
                  </p>
                </div>
                <div className="flex rounded-md border border-border p-0.5 bg-secondary/40 text-xs">
                  <button
                    type="button"
                    onClick={() => setDuplicatePolicy('replace')}
                    className={cn(
                      'rounded px-2.5 py-1 transition-colors',
                      duplicatePolicy === 'replace'
                        ? 'bg-card font-medium text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    覆盖当前
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicatePolicy('parallel')}
                    className={cn(
                      'rounded px-2.5 py-1 transition-colors',
                      duplicatePolicy === 'parallel'
                        ? 'bg-card font-medium text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    并行运行
                  </button>
                </div>
              </div>

              {/* Auto scroll logs */}
              <div className="flex items-center justify-between gap-4 p-3.5">
                <div>
                  <span className="font-medium text-foreground">自动滚动终端日志</span>
                  <p className="mt-0.5 text-muted-foreground">
                    终端有新输出产生时，视图自动跟随滚动到底部最新内容。
                  </p>
                </div>
                <ToggleSwitch
                  checked={autoScrollLogs}
                  onCheckedChange={setAutoScrollLogs}
                  aria-label="自动滚动终端日志"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
