import * as SecureStore from 'expo-secure-store'
import type { ConnectionSettings } from '@devhub/shared'

// The token grants control over the desktop's processes: keep it in the Android Keystore.
const key = 'devhub.connection'

export async function loadConnection(): Promise<ConnectionSettings | null> {
  try {
    const text = await SecureStore.getItemAsync(key)
    if (!text) return null
    const value: unknown = JSON.parse(text)
    if (isSettings(value)) return { baseUrl: value.baseUrl, token: value.token }
  } catch {
    // Unreadable (e.g. the keystore was reset after a backup restore): connect again.
  }
  return null
}

export async function saveConnection(settings: ConnectionSettings): Promise<void> {
  await SecureStore.setItemAsync(key, JSON.stringify(settings))
}

export async function clearConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}

function isSettings(value: unknown): value is ConnectionSettings {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.baseUrl === 'string' && typeof record.token === 'string'
}
