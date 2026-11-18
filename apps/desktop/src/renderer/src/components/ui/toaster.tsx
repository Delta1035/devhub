import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useToasts, toast, type ToastItem } from '@renderer/lib/toast'
import { cn } from '@renderer/lib/utils'

export function Toaster(): React.JSX.Element | null {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t: ToastItem) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2',
            t.type === 'success' && 'border-primary/40 bg-card text-foreground',
            t.type === 'error' && 'border-destructive/40 bg-card text-foreground',
            (!t.type || t.type === 'info') && 'border-border bg-card text-foreground'
          )}
        >
          {t.type === 'success' && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
          {t.type === 'error' && <TriangleAlert className="size-4 shrink-0 text-destructive" />}
          {(!t.type || t.type === 'info') && <Info className="size-4 shrink-0 text-[#7FB2FF]" />}
          <span className="flex-1 font-medium">{t.message}</span>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            aria-label="关闭提示"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
