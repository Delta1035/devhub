import type { ShellApi, UpdateStatus, WindowState } from '@devhub/shared'

export function createMockShell(): ShellApi {
  return {
    async pickDirectory(): Promise<string> {
      return 'D:\\demo\\shop-web'
    },
    async pickFile(): Promise<string> {
      return 'D:\\demo\\shop-web\\package.json'
    },
    async getUpdateStatus(): Promise<UpdateStatus> {
      return { state: 'up-to-date', checkedAt: new Date().toISOString() }
    },
    async checkForUpdates(): Promise<void> {
      await Promise.resolve()
    },
    async downloadUpdate(): Promise<void> {
      await Promise.resolve()
    },
    async installUpdate(): Promise<void> {
      await Promise.resolve()
    },
    onUpdateStatus() {
      return () => undefined
    },
    async openExternal(url: string): Promise<void> {
      window.open(url, '_blank')
    },
    async openProjectFolder(projectId: string): Promise<void> {
      void projectId
      console.log(`[DevHub Mock] Opened project folder: ${projectId}`)
    },
    async getWindowState(): Promise<WindowState> {
      return { platform: 'win32', maximized: false, fullScreen: false }
    },
    onWindowState() {
      return () => undefined
    },
    async minimizeWindow(): Promise<void> {
      await Promise.resolve()
    },
    async toggleMaximizeWindow(): Promise<void> {
      await Promise.resolve()
    },
    async closeWindow(): Promise<void> {
      await Promise.resolve()
    }
  }
}
