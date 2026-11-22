import { ArrowUpDown } from 'lucide-react'
import type { GroupSortOrder } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { groupSortLabels, groupSortOptions, groupSortShortLabels } from './group-sort'

interface GroupSortMenuProps {
  sortOrder: GroupSortOrder
  onSortOrderChange: (order: GroupSortOrder) => void
}

export function GroupSortMenu({
  sortOrder,
  onSortOrderChange
}: GroupSortMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          title={`批量任务排序：${groupSortLabels[sortOrder]}`}
          aria-label="批量任务排序"
        >
          <ArrowUpDown className="size-3.5" data-icon="inline-start" />
          <span className="truncate max-w-[70px]">{groupSortShortLabels[sortOrder]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" aria-label="批量任务排序选项">
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(val) => onSortOrderChange(val as GroupSortOrder)}
        >
          {groupSortOptions.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
