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
  plugins: {
    // Requests go through the WebView's fetch: the event stream needs a streamed body.
    CapacitorHttp: { enabled: false },
    // Self-hosted live updates of the web bundle (ADR 0030); Capawesome Cloud is never used.
    LiveUpdate: {
      // A bundle that does not call ready() within 10 s is rolled back, and not tried again.
      readyTimeout: 10_000,
      autoBlockRolledBackBundles: true,
      autoDeleteBundles: true,
      // Verifies the RSA signature of every downloaded bundle (private key: GitHub Secrets).
      publicKey:
        '-----BEGIN PUBLIC KEY-----MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAuanR3PGuzNyF8N7KDwArl+EaTDC7Xz+oB8LFsnfEaDO2/EYVvhRa+pQM2MbVFm5/0XZR0iljrsGScyXIxUzFKzPQAFDPd20hgJ1QL6U1+y4y6P0Vq9L2aBFHFyTO3sXP28fMrWxP+YZeZm+5jQNJcMF7fggaYU/gfxzAaqBVWpnouc+c7YJPVGZdj/0ojew5lc479PMbIzkLyM6wVwGROMDsXMNbjtDEULojmDIkhknJJhme99EoHuHLWmHy5WmoBkwbAKnTimWoYSCDx//2grijYjU5zReshYk5pU8lU/iWFZVpgXHt1hdrgGNZoty83JnWnag2QUxlIDi37DasKRY0WvuLpcBt78IhefxZlKEU9PAzdCurdnuySyiu+tqqfAto3M/9CGTMyIPbmmhkEl9V63f3eqOUlqAxFSS+8gO25ncJ932q3Yxir8TzXh42ZsEjaJUulwv+X+jaSOPwYpV/Rd67eunW6GgTFS3Lfwo6upda/oCeSO261UgV3e4tAgMBAAE=-----END PUBLIC KEY-----'
    }
  }
}

export default config
