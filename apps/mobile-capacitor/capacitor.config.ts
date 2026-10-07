import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app is the desktop renderer's web build (ADR 0027), loaded from
 * `http://localhost`: an http page may call the desktop's plain-http remote server, which an
 * https page could not (mixed content). The remote server allows exactly this origin (CORS).
 */
const config: CapacitorConfig = {
  appId: 'io.github.delta1035.devhub',
  appName: 'DevHub',
  webDir: '../desktop/out/capacitor',
  server: { androidScheme: 'http' },
  // Requests go through the WebView's fetch: the event stream needs a streamed body.
  plugins: { CapacitorHttp: { enabled: false } }
}

export default config
