import type { GroupSortOrder } from '@devhub/shared'

export const groupSortLabels: Record<GroupSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序 (A-Z)',
  'name-desc': '名称降序 (Z-A)',
  recent: '最近运行'
}

export const groupSortShortLabels: Record<GroupSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序',
  'name-desc': '名称降序',
  recent: '最近运行'
}

export const groupSortOptions: Array<{ value: GroupSortOrder; label: string }> = [
  { value: 'default', label: '默认排序' },
  { value: 'name-asc', label: '名称升序 (A-Z)' },
  { value: 'name-desc', label: '名称降序 (Z-A)' },
  { value: 'recent', label: '最近运行' }
]

export const GROUP_SORT_STORAGE_KEY = 'devhub.groups.sort-order'

export function getStoredGroupSortOrder(): GroupSortOrder {
  try {
    const saved = localStorage.getItem(GROUP_SORT_STORAGE_KEY)
    if (saved && saved in groupSortLabels) {
      return saved as GroupSortOrder
    }
  } catch {
    // ignore
  }
  return 'default'
}
