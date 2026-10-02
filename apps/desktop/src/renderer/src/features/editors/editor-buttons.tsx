import { Loader2 } from 'lucide-react'
import type { EditorId, EditorInfo } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useEditors, useOpenInEditor } from './use-editors'

// Monograms instead of vendor logos: recognizable at 16px and no trademark artwork to ship.
const marks: Record<EditorId, { label: string; short: string; className: string }> = {
  vscode: { label: 'VS', short: 'VS Code', className: 'bg-sky-600' },
  idea: { label: 'IJ', short: 'IDEA', className: 'bg-fuchsia-600' }
}

interface EditorButtonsProps {
  projectId: string
  projectName: string
  /** `icon`: compact, for the project list. `labeled`: with names, for the detail header. */
  variant: 'icon' | 'labeled'
  onError: (error: Error) => void
  className?: string
}

export function EditorButtons({
  projectId,
  projectName,
  variant,
  onError,
  className
}: EditorButtonsProps): React.JSX.Element | null {
  const editors = useEditors()
  const open = useOpenInEditor()
  if (!editors.data) return null

  return (
    <div className={cn('flex shrink-0 items-center gap-1', className)}>
      {editors.data.map((editor) => {
        const opening = open.isPending && open.variables?.editor === editor.id
        return (
          <Button
            key={editor.id}
            variant={variant === 'icon' ? 'ghost' : 'outline'}
            size={variant === 'icon' ? 'icon-xs' : 'sm'}
            disabled={!editor.available || opening}
            onClick={() => open.mutate({ projectId, editor: editor.id }, { onError })}
            title={hint(editor)}
            aria-label={`用 ${editor.name} 打开 ${projectName}`}
          >
            {opening ? <Loader2 className="animate-spin" /> : <EditorMark id={editor.id} />}
            {variant === 'labeled' && marks[editor.id].short}
          </Button>
        )
      })}
    </div>
  )
}

function hint(editor: EditorInfo): string {
  return editor.available ? `用 ${editor.name} 打开` : `未检测到 ${editor.name}`
}

function EditorMark({ id }: { id: EditorId }): React.JSX.Element {
  const mark = marks[id]
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] leading-none font-bold text-white',
        mark.className
      )}
    >
      {mark.label}
    </span>
  )
}
