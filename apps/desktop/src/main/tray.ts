import { Menu, Tray, nativeImage } from 'electron'
// The @2x variants beside these files are picked up automatically on HiDPI displays.
import trayIcon from '../../resources/tray.png?asset'
// macOS recolours "Template" images to match a light or dark menu bar.
import trayTemplateIcon from '../../resources/trayTemplate.png?asset'

export function createTray(handlers: { show: () => void; quit: () => void }): Tray {
  const tray = new Tray(
    nativeImage.createFromPath(process.platform === 'darwin' ? trayTemplateIcon : trayIcon)
  )
  tray.setToolTip('DevHub')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: handlers.show },
      { type: 'separator' },
      { label: '退出 DevHub', click: handlers.quit }
    ])
  )
  tray.on('click', handlers.show)
  return tray
}
