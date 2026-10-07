import { CapacitorHttp } from '@capacitor/core'
import { App } from '@capacitor/app'
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHint
} from '@capacitor/barcode-scanner'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { remoteApiPrefix } from '@devhub/shared'
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

export type ScanResult = { ok: true; text: string } | { ok: false; message: string | null }

/** The scanner plugin's error codes (its messages are English). */
const scanCancelled = 'OS-PLUG-BARC-0006'
const scanCameraDenied = 'OS-PLUG-BARC-0007'

/**
 * Scans the connect QR code from the desktop's settings with the plugin's full-screen scanner
 * (bundled ML Kit: no Google Play services needed). `message` is null when the user cancelled.
 */
export async function scanQrCode(): Promise<ScanResult> {
  try {
    const { ScanResult: text } = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: '扫描电脑上的连接二维码'
    })
    return { ok: true, text }
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code
    if (code === scanCancelled) return { ok: false, message: null }
    if (code === scanCameraDenied) {
      return {
        ok: false,
        message: '没有相机权限：请在系统设置中允许 DevHub 使用相机，或粘贴连接地址'
      }
    }
    return {
      ok: false,
      message: `无法扫码：${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * `GET /api/v1/info` over native HTTP, which CORS does not apply to; null when that fails too.
 * Tells an old desktop (no CORS for the app) from an unreachable one (`explainConnectFailure`).
 */
export async function probeDesktop(baseUrl: string): Promise<unknown> {
  try {
    const response = await CapacitorHttp.get({
      url: `${baseUrl}${remoteApiPrefix}/info`,
      responseType: 'json',
      connectTimeout: 5000,
      readTimeout: 5000
    })
    return response.status === 200 ? response.data : null
  } catch {
    return null
  }
}
