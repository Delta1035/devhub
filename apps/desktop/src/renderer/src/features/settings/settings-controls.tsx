import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

/** One titled group of settings. */
export function SettingsSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h2 className="mb-1 font-heading text-sm font-semibold">{title}</h2>
      <div className="divide-y rounded-lg border bg-card">{children}</div>
    </section>
  )
}

/** A setting: label and explanation on the left, its control on the right. */
export function SettingRow({
  label,
  description,
  htmlFor,
  children
}: {
  label: string
  description?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-48 flex-1">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

/** A small segmented control for a few mutually exclusive options. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded px-3 py-1 text-xs',
            value === option.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A whole-number input that commits on blur or Enter (not on every keystroke), clamped to
 * its range. Typing "1" on the way to "15" therefore never applies a size of 1.
 */
export function NumberSetting({
  id,
  value,
  min,
  max,
  step = 1,
  unit,
  onCommit
}: {
  id: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onCommit: (value: number) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (): void => {
    if (draft === null) return
    const parsed = Number(draft)
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(parsed)) {
      onCommit(Math.min(max, Math.max(min, Math.round(parsed))))
    }
  }
  return (
    <>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        className="h-8 w-24 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </>
  )
}
