import { useState } from 'react'
import { Plus, Trash2, Variable, Check } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ToggleSwitch } from './project-settings-editor'
import { toast } from '@renderer/lib/toast'

interface ProjectSettingsEnvProps {
  project: Project
}

interface EnvVar {
  id: string
  key: string
  value: string
}

export function ProjectSettingsEnv({ project }: ProjectSettingsEnvProps): React.JSX.Element {
  const [inheritSystemEnv, setInheritSystemEnv] = useState(true)
  const [vars, setVars] = useState<EnvVar[]>([
    { id: '1', key: 'NODE_ENV', value: 'development' },
    { id: '2', key: 'PORT', value: '5173' },
    { id: '3', key: 'DEBUG', value: 'api:*' }
  ])
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  const handleAdd = (): void => {
    if (!newKey.trim()) {
      toast.error('变量名不能为空')
      return
    }
    setVars((prev) => [
      ...prev,
      { id: `env-${Date.now()}`, key: newKey.trim(), value: newVal.trim() }
    ])
    setNewKey('')
    setNewVal('')
    toast.success('已添加环境变量')
  }

  const handleDelete = (id: string): void => {
    setVars((prev) => prev.filter((v) => v.id !== id))
    toast.info('已移除变量')
  }

  const handleSave = (): void => {
    toast.success('环境变量配置已保存')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground">环境变量配置</h4>
            <p className="text-xs text-muted-foreground">
              为「{project.name}」的脚本执行注入专属环境变量。
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 gap-1.5 px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="size-3.5" />
            保存变量
          </Button>
        </div>

        {/* Inherit Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-foreground">继承系统环境变量</span>
            <span className="text-[11px] text-muted-foreground">
              启用后，脚本默认继承用户全局环境变量，在此处填写的变量将覆盖同名系统变量
            </span>
          </div>
          <ToggleSwitch
            checked={inheritSystemEnv}
            onCheckedChange={setInheritSystemEnv}
            aria-label="继承系统环境变量"
          />
        </div>
      </section>

      {/* Env Vars Table */}
      <section className="space-y-3">
        <h4 className="font-heading text-sm font-semibold text-foreground">
          变量列表 ({vars.length})
        </h4>

        <div className="overflow-hidden rounded-lg border border-border bg-card/60">
          <div className="grid grid-cols-12 gap-2 border-b border-border bg-secondary/30 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
            <span className="col-span-5">变量名 (KEY)</span>
            <span className="col-span-6">变量值 (VALUE)</span>
            <span className="col-span-1 text-right">操作</span>
          </div>

          <div className="divide-y divide-border">
            {vars.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-12 gap-2 items-center px-3.5 py-2.5 text-xs"
              >
                <div className="col-span-5 flex items-center gap-1.5">
                  <Variable className="size-3.5 text-primary shrink-0" />
                  <code className="font-mono font-medium text-foreground">{v.key}</code>
                </div>
                <div className="col-span-6">
                  <code className="font-mono text-muted-foreground truncate block">{v.value}</code>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(v.id)}
                    className="text-muted-foreground hover:text-destructive"
                    title="删除变量"
                    aria-label={`删除 ${v.key}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Row */}
          <div className="flex flex-col gap-2 border-t border-border bg-secondary/15 p-3 sm:flex-row sm:items-center">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="新变量名 (如 API_BASE)"
              className="h-8 font-mono text-xs flex-1 border-border bg-background"
            />
            <Input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              placeholder="变量值 (如 https://api.dev)"
              className="h-8 font-mono text-xs flex-1 border-border bg-background"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              className="h-8 gap-1 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              <Plus className="size-3.5" />
              添加
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
