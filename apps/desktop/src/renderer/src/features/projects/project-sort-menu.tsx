import { ArrowUpDown } from 'lucide-react'
import type { ProjectSortOrder } from '@devhub/shared'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { projectSortLabels, projectSortOptions, projectSortShortLabels } from './project-sort'

interface ProjectSortMenuProps {
  sortOrder: ProjectSortOrder
  onSortOrderChange: (order: ProjectSortOrder) => void
}

export function ProjectSortMenu({
  sortOrder,
  onSortOrderChange
}: ProjectSortMenuProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          title={`项目排序：${projectSortLabels[sortOrder]}`}
          aria-label="项目排序"
        >
          <ArrowUpDown className="size-3.5" data-icon="inline-start" />
          <span className="truncate max-w-[70px]">{projectSortShortLabels[sortOrder]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" aria-label="项目排序选项">
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(val) => onSortOrderChange(val as ProjectSortOrder)}
        >
          {projectSortOptions.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
