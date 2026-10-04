import { appearance, type UiStyle } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/utils'
import { usePreference } from './use-settings'

/** Swatches show each style's own colors (background, surface, primary), whatever is active. */
const styleOptions: { value: UiStyle; label: string; swatch: [string, string, string] }[] = [
  { value: 'neutral', label: 'Neutral', swatch: ['#ffffff', '#f5f5f5', '#171717'] },
  { value: 'material', label: 'Material 3', swatch: ['#fef7ff', '#e8def8', '#6750a4'] },
  { value: 'fluent', label: 'Fluent', swatch: ['#f3f3f3', '#fbfbfb', '#005fb8'] }
]

/** Picks the design style; applies at once to the whole window, terminals included. */
export function StylePicker(): React.JSX.Element {
  const current = usePreference(appearance, appearance.style)
  return (
    <div role="radiogroup" aria-label="风格" className="flex gap-2">
      {styleOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={current === option.value}
          onClick={() => appearance.setStyle(option.value)}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-md border p-2 text-xs hover:bg-muted',
            current === option.value && 'border-primary ring-1 ring-primary'
          )}
        >
          <span className="flex overflow-hidden rounded-sm border" aria-hidden>
            {option.swatch.map((color) => (
              <span key={color} className="h-5 w-4" style={{ backgroundColor: color }} />
            ))}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  )
}
