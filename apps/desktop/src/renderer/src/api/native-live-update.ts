import { CapacitorHttp } from '@capacitor/core'
import { LiveUpdate } from '@capawesome/capacitor-live-update'
import { checkLiveUpdate, liveUpdateManifestName, planLiveUpdate } from '@devhub/shared'
import type { AppUpdateState } from './app-update'

/*
 * The Android app's live updates (ADR 0030): it shows the web bundle of the desktop it is
 * connected to. Every release publishes the bundle and its manifest next to the APK; the plugin
 * verifies the zip's checksum and signature against the public key in capacitor.config.ts.
 */

/** Where a release's files are. A debug build can point at a local server to test updates. */
const releaseFiles = (version: string): string =>
  (
    import.meta.env.VITE_LIVE_UPDATE_URL ??
    'https://github.com/Delta1035/devhub/releases/download/v{version}/'
  ).replaceAll('{version}', version)

/**
 * Tells the plugin this bundle started fine. Without it within `readyTimeout`, the plugin goes
 * back to the previous bundle, so a broken update cannot lock the user out.
 */
export async function confirmBundle(): Promise<void> {
  await LiveUpdate.ready()
}

export async function syncWebBundle(
  desktopVersion: string | undefined,
  set: (next: AppUpdateState) => void
): Promise<void> {
  const [{ bundleId: current }, { bundleId: next }, { versionName }, { versionCode }] =
    await Promise.all([
      LiveUpdate.getCurrentBundle(),
      LiveUpdate.getNextBundle(),
      LiveUpdate.getVersionName(),
      LiveUpdate.getVersionCode()
    ])
  // Bundle ids are versions; null is the bundle inside the APK.
  const shown = current ?? versionName
  const pending = next ?? versionName
  const readyIfPending = (target: string): void =>
    set(target === shown ? { state: 'idle' } : { state: 'ready', version: target })

  const step = planLiveUpdate({ desktopVersion, current: pending, builtIn: versionName })
  if (step.action === 'none') return readyIfPending(pending)
  if (step.action === 'reset') {
    await LiveUpdate.reset()
    return readyIfPending(versionName)
  }

  const { version } = step
  // A bundle that failed to start was rolled back and blocked: do not loop on it.
  const { bundleIds: blocked } = await LiveUpdate.getBlockedBundles()
  if (blocked.includes(version)) {
    return set({ state: 'failed', version, message: `${version} 版界面启动失败，已退回原版本` })
  }
  const { bundleIds } = await LiveUpdate.getDownloadedBundles()
  if (!bundleIds.includes(version)) {
    const base = releaseFiles(version)
    // Native HTTP: GitHub's release downloads send no CORS headers, so the page's fetch from
    // http://localhost cannot read them. (The zip itself is downloaded by the plugin, natively.)
    const response = await CapacitorHttp.get({
      url: base + liveUpdateManifestName(version),
      responseType: 'json'
    }).catch(() => null)
    // Development desktops and unpublished releases have no bundle: keep the current one.
    if (response?.status !== 200) {
      console.info(`[live-update] no web bundle published for ${version}`)
      return readyIfPending(pending)
    }
    const check = checkLiveUpdate(response.data, {
      version,
      versionCode: Number(versionCode)
    })
    if (check.action === 'invalid') {
      console.warn(`[live-update] ${check.reason}`)
      return readyIfPending(pending)
    }
    if (check.action === 'install-apk') return set({ state: 'install-apk', version })

    set({ state: 'downloading', version })
    try {
      await LiveUpdate.downloadBundle({
        url: base + check.manifest.bundle,
        bundleId: version,
        checksum: check.manifest.checksum,
        signature: check.manifest.signature
      })
    } catch (error) {
      console.warn('[live-update] download failed', error)
      return set({ state: 'failed', version, message: '界面更新下载失败，下次连接时重试' })
    }
  }
  await LiveUpdate.setNextBundle({ bundleId: version })
  readyIfPending(version)
}

export async function restartWebView(): Promise<void> {
  await LiveUpdate.reload()
}
