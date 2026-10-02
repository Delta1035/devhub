import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { parseExternalUrl } from './core/shell/external-url'

export function createMainWindow(shouldHideOnClose: () => boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    // macOS takes the icon from the app bundle; elsewhere this also covers dev mode.
    ...(process.platform === 'darwin' ? {} : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  window.on('ready-to-show', () => window.show())

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
