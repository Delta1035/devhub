import { useState } from 'react'
import {
  Activity,
  Check,
  ExternalLink,
  FileCode,
  Info,
  Settings,
  Smartphone,
  Variable,
  Workflow
} from 'lucide-react'
import type { Project, Script } from '@devhub/shared'
import { api } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { toast } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'
import { ProjectSettingsEditor, ToggleSwitch } from './project-settings-editor'
import { ProjectSettingsEnv } from './project-settings-env'
import { ProjectSettingsGeneral } from './project-settings-general'
import { ProjectSettingsGroups } from './project-settings-groups'
import { ProjectSettingsPorts } from './project-settings-ports'
import { ProjectSettingsRemote } from './project-settings-remote'
import { defaultYamlContent, parseYamlScripts } from './project-settings-yaml'

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
  const [yamlContent, setYamlContent] = useState(defaultYamlContent)
  const [savedYaml, setSavedYaml] = useState(defaultYamlContent)
  const [historyStack, setHistoryStack] = useState<string[]>([])
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [checkPortsOnStart, setCheckPortsOnStart] = useState(true)
  const [autoScrollLogs, setAutoScrollLogs] = useState(true)
  const [duplicatePolicy, setDuplicatePolicy] = useState<'replace' | 'parallel'>('replace')

  const isDirty = yamlContent !== savedYaml
  const detectedCount = scripts.length

  const handleYamlChange = (newVal: string): void => {
    setHistoryStack((prev) => [...prev.slice(-20), yamlContent])
    setYamlContent(newVal)
  }

  const handleUndo = (): void => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1]
      setHistoryStack((stack) => stack.slice(0, -1))
      if (prev !== undefined) {
        setYamlContent(prev)
      }
    }
  }

  const handleFormat = (): void => {
    const lines = yamlContent.split('\n')
    const formatted = lines
      .map((l) => (l.trim().startsWith('#') ? l : l.replace(/\t/g, '  ')))
      .join('\n')
    handleYamlChange(formatted)
    toast.success('已格式化 YAML 配置')
  }

  const handleDiscard = (): void => {
    setYamlContent(savedYaml)
    setHistoryStack([])
    toast.info('已放弃所有未保存修改')
  }

  const handleSave = (): void => {
    setSavedYaml(yamlContent)
    setSaveSuccess(true)
    toast.success('项目配置已成功保存')
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const handleOpenEditor = (): void => {
    api
      .openInEditor(project.id, 'vscode')
      .then(() => toast.success('已在 VS Code 中打开项目'))
      .catch(() => toast.info('已在默认编辑器中打开项目'))
  }

  const handleShowDocs = (): void => {
    toast.info('查看 DevHub 官方配置规范文档: https://github.com/Delta1035/devhub')
  }

  const parsedItems = parseYamlScripts(yamlContent)

  const navItems = [
    { key: 'general' as const, label: '常规设置', icon: Settings },
    { key: 'scripts' as const, label: '自定义脚本', icon: FileCode, count: parsedItems.length },
    { key: 'ports' as const, label: '端口与健康检查', icon: Activity },
    { key: 'env' as const, label: '环境变量', icon: Variable },
    { key: 'groups' as const, label: '批量任务规则', icon: Workflow },
    { key: 'remote' as const, label: '远程访问', icon: Smartphone }
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Settings Header Aligned with pen/devhub.pen */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 md:px-6 md:py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-base font-semibold text-foreground">项目设置</h3>
            <span className="rounded bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">
              {project.name}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            配置保存在项目根目录的 <code className="font-mono text-foreground">.devhub.yaml</code>
            ，可随仓库提交。
          </p>
        </div>

        {activeSection === 'scripts' && (
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:text-foreground"
              >
                放弃更改
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty && !saveSuccess}
              className={cn(
                'h-8 gap-1.5 px-3 text-xs font-semibold shadow-xs',
                saveSuccess
                  ? 'bg-success text-primary-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {saveSuccess ? (
                <>
                  <Check className="size-3.5" />
                  已保存
                </>
              ) : (
                '保存设置'
              )}
            </Button>
          </div>
        )}
      </header>

      {/* Split Body */}
      <div className="flex min-h-0 flex-1">
        {/* Left Nav (196px) */}
        <aside className="w-52 shrink-0 border-r border-border bg-sidebar p-3 flex flex-col gap-1">
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
                <Icon className={cn('size-3.5 shrink-0', isActive && 'text-primary')} />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.2 font-mono text-[10px] text-primary font-semibold">
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}

          <div className="flex-1" />

          {/* Config file path card */}
          <div className="rounded-lg border border-border bg-card/60 p-2.5 text-xs">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              配置文件路径
            </span>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
              {project.path}\.devhub.yaml
            </p>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {activeSection === 'general' && <ProjectSettingsGeneral project={project} />}

          {activeSection === 'scripts' && (
            <div className="space-y-6">
              {/* YAML Editor Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-heading text-sm font-semibold text-foreground">
                      自定义脚本
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      已检测 {detectedCount} 个脚本。补充自定义脚本后保存即时生效。
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleShowDocs}
                      className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Info className="size-3" />
                      查看文档
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenEditor}
                      className="h-7 gap-1 border-border bg-secondary/60 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3" />
                      在编辑器中打开
                    </Button>
                  </div>
                </div>

                <ProjectSettingsEditor
                  yamlContent={yamlContent}
                  isDirty={isDirty}
                  canUndo={historyStack.length > 0}
                  parsedItems={parsedItems}
                  onYamlChange={handleYamlChange}
                  onFormat={handleFormat}
                  onUndo={handleUndo}
                />
              </section>

              {/* Startup Behavior Section */}
              <section className="space-y-3">
                <h4 className="font-heading text-sm font-semibold text-foreground">启动行为</h4>
                <div className="divide-y divide-border rounded-lg border border-border bg-card/60">
                  {/* Check ports */}
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">
                        启动前检查端口占用
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        端口被其他进程占用时先提示，可选择停止该进程
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={checkPortsOnStart}
                      onCheckedChange={(checked) => {
                        setCheckPortsOnStart(checked)
                        toast.success(checked ? '已开启端口检查' : '已关闭端口检查')
                      }}
                      aria-label="启动前检查端口占用"
                    />
                  </div>

                  {/* Duplicate policy */}
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">
                        重复运行同名脚本时
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        决定再次启动时是覆盖当前进程还是并行再开一个
                      </span>
                    </div>
                    <div className="flex rounded-md border border-border bg-[#171C23] p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicatePolicy('replace')
                          toast.success('已切换为：覆盖当前进程')
                        }}
                        className={cn(
                          'rounded px-2.5 py-1 text-xs transition-colors',
                          duplicatePolicy === 'replace'
                            ? 'bg-[#1A2028] font-medium text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        覆盖当前
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicatePolicy('parallel')
                          toast.success('已切换为：并行运行新进程')
                        }}
                        className={cn(
                          'rounded px-2.5 py-1 text-xs transition-colors',
                          duplicatePolicy === 'parallel'
                            ? 'bg-[#1A2028] font-medium text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        并行运行
                      </button>
                    </div>
                  </div>

                  {/* Auto scroll */}
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">自动滚动日志</span>
                      <span className="text-[11px] text-muted-foreground">
                        新输出到达时自动滚动到底部
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={autoScrollLogs}
                      onCheckedChange={(checked) => {
                        setAutoScrollLogs(checked)
                        toast.success(checked ? '已开启自动滚动日志' : '已关闭自动滚动日志')
                      }}
                      aria-label="自动滚动日志"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeSection === 'ports' && (
            <ProjectSettingsPorts project={project} scripts={scripts} />
          )}

          {activeSection === 'env' && <ProjectSettingsEnv project={project} />}

          {activeSection === 'groups' && <ProjectSettingsGroups project={project} />}

          {activeSection === 'remote' && <ProjectSettingsRemote project={project} />}
        </div>
      </div>
    </div>
  )
}
