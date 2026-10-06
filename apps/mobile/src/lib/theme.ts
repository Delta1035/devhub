import { useColorScheme } from 'react-native'
import type { RunTone } from '@/features/runs/run-status'

const light = {
  background: '#ffffff',
  card: '#f4f4f5',
  text: '#09090b',
  muted: '#71717a',
  border: '#e4e4e7',
  primary: '#18181b',
  primaryText: '#fafafa',
  danger: '#dc2626',
  logBackground: '#18181b',
  logText: '#e4e4e7',
  tone: { running: '#16a34a', pending: '#d97706', failed: '#dc2626', idle: '#a1a1aa' }
}

const dark: typeof light = {
  background: '#09090b',
  card: '#18181b',
  text: '#fafafa',
  muted: '#a1a1aa',
  border: '#27272a',
  primary: '#fafafa',
  primaryText: '#18181b',
  danger: '#f87171',
  logBackground: '#000000',
  logText: '#e4e4e7',
  tone: { running: '#22c55e', pending: '#f59e0b', failed: '#f87171', idle: '#71717a' }
}

export type Colors = typeof light & { tone: Record<RunTone, string> }

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
