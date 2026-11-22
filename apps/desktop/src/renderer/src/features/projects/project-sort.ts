import type { ProjectSortOrder } from '@devhub/shared'

export const projectSortLabels: Record<ProjectSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序 (A-Z)',
  'name-desc': '名称降序 (Z-A)',
  'path-asc': '路径升序',
  'path-desc': '路径降序'
}

export const projectSortShortLabels: Record<ProjectSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序',
  'name-desc': '名称降序',
  'path-asc': '路径升序',
  'path-desc': '路径降序'
}

export const projectSortOptions: Array<{ value: ProjectSortOrder; label: string }> = [
  { value: 'default', label: '默认排序' },
  { value: 'name-asc', label: '名称升序 (A-Z)' },
  { value: 'name-desc', label: '名称降序 (Z-A)' },
  { value: 'path-asc', label: '路径升序' },
  { value: 'path-desc', label: '路径降序' }
]

export const PROJECT_SORT_STORAGE_KEY = 'devhub.projects.sort-order'

export function getStoredProjectSortOrder(): ProjectSortOrder {
  try {
    const saved = localStorage.getItem(PROJECT_SORT_STORAGE_KEY)
    if (saved && saved in projectSortLabels) {
      return saved as ProjectSortOrder
    }
  } catch {
    // ignore
  }
  return 'default'
}
