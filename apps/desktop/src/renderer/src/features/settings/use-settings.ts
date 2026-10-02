import { useSyncExternalStore } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import type { Settings, SettingsPatch } from '@devhub/shared'
import { api } from '@renderer/api'

const settingsKey = ['settings'] as const

export function useSettings(): UseQueryResult<Settings> {
  return useQuery({ queryKey: settingsKey, queryFn: () => api.getSettings() })
}

export function useUpdateSettings(): UseMutationResult<Settings, Error, SettingsPatch> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch) => api.updateSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey, settings)
      // Both depend on settings: custom editor paths and the default shell.
      void queryClient.invalidateQueries({ queryKey: ['editors'] })
      void queryClient.invalidateQueries({ queryKey: ['shells'] })
    }
  })
}

/** Subscribes a component to a per-device preference store (theme, terminal look). */
export function usePreference<T>(
  store: { subscribe: (listener: () => void) => () => void },
  read: () => T
): T {
  return useSyncExternalStore((listener) => store.subscribe(listener), read)
}
