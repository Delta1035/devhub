import { CheckCircle2, FileCode, RotateCcw, Sparkles } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'
import type { ParsedYamlScript } from './project-settings-yaml'

export function ToggleSwitch({
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
        checked ? 'bg-primary' : 'bg-secondary'
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

interface ProjectSettingsEditorProps {
  yamlContent: string
  isDirty: boolean
  canUndo: boolean
  parsedItems: ParsedYamlScript[]
  onYamlChange: (val: string) => void
  onFormat: () => void
  onUndo: () => void
}

export function ProjectSettingsEditor({
  yamlContent,
  isDirty,
  canUndo,
  parsedItems,
  onYamlChange,
  onFormat,
  onUndo
}: ProjectSettingsEditorProps): React.JSX.Element {
  const lineCount = yamlContent.split('\n').length

  return (
    <div className="space-y-3">
      {/* Code Editor Box */}
      <div className="overflow-hidden rounded-lg border border-border bg-[#08090C]">
        {/* Editor Header */}
        <div className="flex items-center justify-between border-b border-border bg-[#0C0F13] px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <FileCode className="size-3.5 text-primary" />
            <span className="font-mono text-[11px] text-foreground font-medium">.devhub.yaml</span>
            {isDirty ? (
              <Badge
                variant="secondary"
                className="bg-[#2A2118] text-[#F5C451] border-0 text-[10px]"
              >
                未保存的更改
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-0 text-[10px]"
              >
                已保存
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFormat}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles className="size-3" />
              格式化
            </button>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              撤销
            </button>
          </div>
        </div>

        {/* Code Area with Line Numbers */}
        <div className="flex min-h-[180px] font-mono text-xs">
          <div className="select-none bg-[#0A0D10] py-2 px-2.5 text-right text-[11px] text-[#6F7A8B] border-r border-[#212731]">
            {Array.from({ length: Math.max(lineCount, 6) }).map((_, i) => (
              <div key={i} className="leading-5">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            value={yamlContent}
            onChange={(e) => onYamlChange(e.target.value)}
            className="flex-1 resize-none bg-transparent p-2 leading-5 text-[#E8ECF2] placeholder:text-muted-foreground outline-none font-mono selection:bg-primary/20"
            rows={Math.max(lineCount, 6)}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Parse Result Preview Pills */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2.5 text-xs">
        <CheckCircle2 className="size-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground font-medium">
          解析成功 · 新增 {parsedItems.length} 个脚本
        </span>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">
          {parsedItems.map((item) => (
            <span
              key={item.name}
              className="rounded border border-border-strong bg-[#171C23] px-2 py-0.5 font-mono text-[11px] text-[#7FB2FF]"
            >
              {item.name} → {item.command}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
