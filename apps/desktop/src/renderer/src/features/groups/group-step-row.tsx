import { ArrowDown, ArrowUp, X } from 'lucide-react'
import type { Project } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useProjectScripts } from '@renderer/features/scripts/use-scripts'
import { cn } from '@renderer/lib/utils'
import { conditionLabels, conditionTypes, type DraftStep } from './group-draft'

const selectClass =
  'h-8 min-w-0 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface GroupStepRowProps {
  index: number
  step: DraftStep
  projects: Project[]
  serial: boolean
  isFirst: boolean
  isLast: boolean
  onChange: (step: DraftStep) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}

export function GroupStepRow({
  index,
  step,
  projects,
  serial,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove
}: GroupStepRowProps): React.JSX.Element {
  const update = (changes: Partial<DraftStep>): void => onChange({ ...step, ...changes })
  const projectKnown = projects.some((project) => project.id === step.projectId)
  const label = `第 ${index + 1} 步`

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3" aria-label={label}>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
          {index + 1}
        </span>
        <select
          aria-label={`${label}的项目`}
          className={cn(selectClass, 'flex-1')}
          value={step.projectId}
          onChange={(event) => update({ projectId: event.target.value, scriptId: '' })}
        >
          <option value="" disabled>
            选择项目
          </option>
          {!projectKnown && step.projectId && (
            <option value={step.projectId}>（已移除的项目）</option>
          )}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <ScriptSelect
          label={`${label}的脚本`}
          projectId={projectKnown ? step.projectId : ''}
          value={step.scriptId}
          onChange={(scriptId) => update({ scriptId })}
        />
        <div className="flex shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={isFirst}
            onClick={() => onMove(-1)}
            aria-label={`上移${label}`}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={isLast}
            onClick={() => onMove(1)}
            aria-label={`下移${label}`}
          >
            <ArrowDown />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={`删除${label}`}>
            <X />
          </Button>
        </div>
      </div>

      {serial && (
        <div className="flex flex-wrap items-center gap-2 pl-8 text-sm">
          <span className="text-xs text-muted-foreground">完成后继续：</span>
          <select
            aria-label={`${label}的继续条件`}
            className={selectClass}
            value={step.type}
            onChange={(event) => {
              const type = conditionTypes.find((candidate) => candidate === event.target.value)
              if (type) update({ type })
            }}
          >
            {conditionTypes.map((type) => (
              <option key={type} value={type}>
                {conditionLabels[type]}
              </option>
            ))}
          </select>
          {step.type === 'output' && (
            <Input
              aria-label={`${label}等待的文字`}
              className="h-8 w-56"
              placeholder={
                step.regex
                  ? String.raw`如 Started \w+ in [\d.]+`
                  : '如 Started Application / ready in'
              }
              value={step.text}
              onChange={(event) => update({ text: event.target.value })}
            />
          )}
          {step.type === 'output' && (
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                aria-label={`${label}使用正则`}
                checked={step.regex}
                onChange={(event) => update({ regex: event.target.checked })}
              />
              正则
            </label>
          )}
          {step.type === 'port' && (
            <Input
              aria-label={`${label}的端口`}
              className="h-8 w-24"
              inputMode="numeric"
              placeholder="8080"
              value={step.port}
              onChange={(event) => update({ port: event.target.value })}
            />
          )}
          {step.type === 'http' && (
            <Input
              aria-label={`${label}的地址`}
              className="h-8 w-72"
              placeholder="http://localhost:8080/actuator/health"
              value={step.url}
              onChange={(event) => update({ url: event.target.value })}
            />
          )}
          {step.type === 'delay' ? (
            <>
              <Input
                aria-label={`${label}等待的秒数`}
                className="h-8 w-20"
                inputMode="numeric"
                value={step.seconds}
                onChange={(event) => update({ seconds: event.target.value })}
              />
              <span className="text-xs text-muted-foreground">秒</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">超时</span>
              <Input
                aria-label={`${label}的超时秒数`}
                className="h-8 w-20"
                inputMode="numeric"
                value={step.timeout}
                onChange={(event) => update({ timeout: event.target.value })}
              />
              <span className="text-xs text-muted-foreground">秒</span>
            </>
          )}
        </div>
      )}
    </li>
  )
}

interface ScriptSelectProps {
  label: string
  projectId: string
  value: string
  onChange: (scriptId: string) => void
}

/** Lists the scripts detected in the chosen project. */
function ScriptSelect({ label, projectId, value, onChange }: ScriptSelectProps): React.JSX.Element {
  const scripts = useProjectScripts(projectId)
  const items = projectId ? (scripts.data?.scripts ?? []) : []
  const known = items.some((script) => script.id === value)

  return (
    <select
      aria-label={label}
      className={cn(selectClass, 'flex-1')}
      value={value}
      disabled={!projectId}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" disabled>
        {scripts.isPending && projectId ? '读取脚本…' : '选择脚本'}
      </option>
      {!known && value && <option value={value}>{value}（未找到）</option>}
      {items.map((script) => (
        <option key={script.id} value={script.id}>
          {script.name} · {script.source}
        </option>
      ))}
    </select>
  )
}
