import { App } from '@capacitor/app'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import type { SavedConnection } from './remote-connection'

/*
 * The Android app's platform pieces (ADR 0027). Loaded on demand and only inside the app, so the
 * web app and the desktop never download the Capacitor plugins.
 */

const baseUrlKey = 'devhub.remoteBaseUrl'
const tokenKey = 'devhub.remoteToken'

/** The address and token, encrypted with a key held by the Android Keystore. */
export async function loadConnection(): Promise<SavedConnection> {
  const [baseUrl, token] = await Promise.all([
    SecureStorage.getItem(baseUrlKey),
    SecureStorage.getItem(tokenKey)
  ])
  return { baseUrl: baseUrl ?? '', token }
}

export async function saveConnection({ baseUrl, token }: SavedConnection): Promise<void> {
  await SecureStorage.setItem(baseUrlKey, baseUrl)
  if (token === null) await SecureStorage.removeItem(tokenKey)
  else await SecureStorage.setItem(tokenKey, token)
}

/** Radix overlays (dialogs, the drawer, menus, selects) mark themselves open like this. */
const openOverlay = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]'
].join(',')

/**
 * Android's back button closes the topmost overlay, as Escape does; with nothing open it sends
 * the app to the background instead of closing it, so the connection survives.
 */
export function handleBackButton(): void {
  void App.addListener('backButton', () => {
    if (document.querySelector(openOverlay)) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    } else void App.minimizeApp()
  })
}
