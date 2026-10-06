import type { Page } from '@playwright/test'
import type { RemoteState } from '@devhub/shared'
import type { DevhubApp, DevhubWindow } from './fixtures'

/** Turns on the desktop's remote server on 127.0.0.1 and returns its state (with the token). */
export const enableRemote = (page: Page, port: number): Promise<RemoteState> =>
  page.evaluate(
    (listenPort) =>
      (window as unknown as DevhubWindow).devhub.updateRemoteConfig({
        enabled: true,
        host: '127.0.0.1',
        port: listenPort
      }),
    port
  )

/**
 * Opens the web app the way a phone's browser would: a window without DevHub's preload bridge,
 * so the renderer has to use the remote server.
 */
export async function openWebApp(
  { app }: DevhubApp,
  url: string,
  size: { width: number; height: number } = { width: 1000, height: 800 }
): Promise<Page> {
  const [web] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(
      ({ BrowserWindow }, { target, width, height }) => {
        const window = new BrowserWindow({ width, height, useContentSize: true })
        void window.loadURL(target)
      },
      { target: url, ...size }
    )
  ])
  return web
}
