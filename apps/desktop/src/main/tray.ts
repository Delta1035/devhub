import { Menu, Tray, nativeImage } from 'electron'
import icon from '../../resources/icon.png?asset'

export function createTray(handlers: { show: () => void; quit: () => void }): Tray {
  const tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
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
