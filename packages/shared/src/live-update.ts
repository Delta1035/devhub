import { z } from 'zod'
import { remoteProtocolVersion } from './remote'

/*
 * Live updates of the Android app's web bundle (ADR 0030). The app shows the web bundle of the
 * desktop it is connected to, as the hosted web app does: every release publishes the bundle
 * and this manifest, and the app fetches the ones matching the desktop's version.
 */

const version = z.string().regex(/^\d+\.\d+\.\d+$/)

export const liveUpdateManifestSchema = z.object({
  version,
  /** The oldest app build (Android versionCode) whose native side can run this bundle. */
  minVersionCode: z.number().int().positive(),
  /** File name of the zip, next to the manifest. */
  bundle: z.string().regex(/^[\w.-]+\.zip$/),
  /** SHA-256 of the zip, hex. */
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  /** RSA SHA-256 signature of the zip, base64; the app holds the public key. */
  signature: z.string().min(1)
})
export type LiveUpdateManifest = z.infer<typeof liveUpdateManifestSchema>

/** File name of a release's manifest, published next to its bundle. */
export const liveUpdateManifestName = (appVersion: string): string =>
  `devhub-web-${appVersion}.json`

export type LiveUpdateStep =
  /** Already showing the desktop's version, or the desktop does not say its version. */
  | { action: 'none' }
  /** The desktop matches the web bundle inside the APK: go back to it. */
  | { action: 'reset' }
  /** Fetch the manifest of this version, then `checkLiveUpdate`. */
  | { action: 'fetch'; version: string }

/**
 * What to do once connected. `current` is the version of the web bundle shown now; `builtIn` the
 * one inside the APK (its versionName).
 */
export function planLiveUpdate({
  desktopVersion,
  current,
  builtIn
}: {
  desktopVersion: string | undefined
  current: string
  builtIn: string
}): LiveUpdateStep {
  if (desktopVersion === undefined || !version.safeParse(desktopVersion).success) {
    return { action: 'none' }
  }
  if (desktopVersion === current) return { action: 'none' }
  if (desktopVersion === builtIn) return { action: 'reset' }
  return { action: 'fetch', version: desktopVersion }
}

export type LiveUpdateCheck =
  | { action: 'download'; manifest: LiveUpdateManifest }
  /** The bundle needs native code this app build lacks: a newer APK is required. */
  | { action: 'install-apk'; version: string }
  | { action: 'invalid'; reason: string }

/** Validates a fetched manifest against the version asked for and this app build. */
export function checkLiveUpdate(
  value: unknown,
  { version: wanted, versionCode }: { version: string; versionCode: number }
): LiveUpdateCheck {
  const parsed = liveUpdateManifestSchema.safeParse(value)
  if (!parsed.success) return { action: 'invalid', reason: 'malformed manifest' }
  const manifest = parsed.data
  if (manifest.version !== wanted) {
    return { action: 'invalid', reason: `manifest is for ${manifest.version}, not ${wanted}` }
  }
  if (manifest.minVersionCode > versionCode) return { action: 'install-apk', version: wanted }
  return { action: 'download', manifest }
}

/**
 * Which side is behind when the desktop speaks another remote protocol than this client, or null
 * when they match. Only the Android app can differ: the web app comes from the desktop itself.
 */
export function protocolMismatch(desktopProtocol: number): 'desktop' | 'app' | null {
  if (desktopProtocol === remoteProtocolVersion) return null
  return desktopProtocol < remoteProtocolVersion ? 'desktop' : 'app'
}
