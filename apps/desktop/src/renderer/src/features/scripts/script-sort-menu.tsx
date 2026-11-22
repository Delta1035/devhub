import { ArrowUpDown } from 'lucide-react'
import type { ScriptSortOrder } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { scriptSortLabels, scriptSortOptions, scriptSortShortLabels } from './script-sort'

interface ScriptSortMenuProps {
  sortOrder: ScriptSortOrder
  onSortOrderChange: (order: ScriptSortOrder) => void
}

export function ScriptSortMenu({
  sortOrder,
  onSortOrderChange
}: ScriptSortMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          title={`脚本排序：${scriptSortLabels[sortOrder]}`}
          aria-label="脚本排序"
        >
          <ArrowUpDown className="size-3.5" data-icon="inline-start" />
          <span className="truncate max-w-[70px]">{scriptSortShortLabels[sortOrder]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" aria-label="脚本排序选项">
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(val) => onSortOrderChange(val as ScriptSortOrder)}
        >
          {scriptSortOptions.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
