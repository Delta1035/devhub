import type { ScriptSortOrder } from '@devhub/shared'

export const scriptSortLabels: Record<ScriptSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序 (A-Z)',
  'name-desc': '名称降序 (Z-A)',
  'active-first': '运行中优先'
}

export const scriptSortShortLabels: Record<ScriptSortOrder, string> = {
  default: '默认排序',
  'name-asc': '名称升序',
  'name-desc': '名称降序',
  'active-first': '运行中优先'
}

export const scriptSortOptions: Array<{ value: ScriptSortOrder; label: string }> = [
  { value: 'default', label: '默认排序' },
  { value: 'name-asc', label: '名称升序 (A-Z)' },
  { value: 'name-desc', label: '名称降序 (Z-A)' },
  { value: 'active-first', label: '运行中优先' }
]

export const SCRIPT_SORT_STORAGE_KEY = 'devhub.scripts.sort-order'

export function getStoredScriptSortOrder(): ScriptSortOrder {
  try {
    const saved = localStorage.getItem(SCRIPT_SORT_STORAGE_KEY)
    if (saved && saved in scriptSortLabels) {
      return saved as ScriptSortOrder
    }
  } catch {
    // ignore
  }
  return 'default'
}
