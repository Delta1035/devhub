import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { parseExternalUrl } from './core/shell/external-url'
import { publishWindowState } from './window-controls'

export function createMainWindow(shouldHideOnClose: () => boolean): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    // The renderer draws the title bar (ADR 0010). macOS keeps its traffic lights, inset
    // into that bar and vertically centred in its 40px height.
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 14, y: 13 } }
      : { frame: false }),
    // macOS takes the icon from the app bundle; elsewhere this also covers dev mode.
    ...(isMac ? {} : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  window.on('ready-to-show', () => window.show())
  publishWindowState(window)

  // Closing the window keeps managed processes running; the app lives on in the tray.
  window.on('close', (event) => {
    if (shouldHideOnClose()) {
      event.preventDefault()
      window.hide()
    }
  })

  // Never open new Electron windows; hand safe (http/https) links to the browser and drop
  // everything else, since a URL may originate from untrusted process output.
  window.webContents.setWindowOpenHandler((details) => {
    try {
      void shell.openExternal(parseExternalUrl(details.url))
    } catch {
      console.warn('[window] blocked opening', details.url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}
