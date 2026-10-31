export function SidebarSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="正在准备导航" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="h-8 shrink-0 rounded-md bg-muted" />
      <div className="flex h-9 shrink-0 gap-1 rounded-lg bg-muted p-1">
        <div className="h-full flex-1 rounded-md bg-background/70" />
        <div className="h-full flex-1" />
      </div>
      <div className="flex flex-col gap-1 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex h-11 items-center gap-2 rounded-lg px-2">
            <div className="size-4 shrink-0 rounded bg-muted" />
            <div className="h-3 rounded bg-muted" style={{ width: `${58 + (index % 3) * 12}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
