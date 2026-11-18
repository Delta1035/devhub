import { app, BrowserWindow, nativeImage } from 'electron'
import iconDarkPng from '../../resources/icon-dark.png?asset'
import iconLightPng from '../../resources/icon-light.png?asset'
import iconDarkIco from '../../resources/icon-dark.ico?asset'
import iconLightIco from '../../resources/icon-light.ico?asset'

/**
 * Updates the running window and taskbar (or macOS dock) icon according to the theme.
 */
export function applyWindowThemeIcon(window: BrowserWindow, theme: 'light' | 'dark'): void {
  if (window.isDestroyed()) return
  if (process.platform === 'darwin') {
    const chosenPng = theme === 'light' ? iconLightPng : iconDarkPng
    const img = nativeImage?.createFromPath ? nativeImage.createFromPath(chosenPng) : chosenPng
    app.dock?.setIcon(img as unknown as Parameters<NonNullable<typeof app.dock>['setIcon']>[0])
  } else if (process.platform === 'win32') {
    const chosenIco = theme === 'light' ? iconLightIco : iconDarkIco
    const img = nativeImage?.createFromPath ? nativeImage.createFromPath(chosenIco) : null
    window.setIcon(img && !img.isEmpty() ? img : chosenIco)
  } else {
    const chosenPng = theme === 'light' ? iconLightPng : iconDarkPng
    const img = nativeImage?.createFromPath ? nativeImage.createFromPath(chosenPng) : null
    window.setIcon(img && !img.isEmpty() ? img : chosenPng)
  }
}
