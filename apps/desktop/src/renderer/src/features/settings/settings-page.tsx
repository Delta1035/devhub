import { useState } from 'react'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import type { EditorId, Settings, SettingsPatch } from '@devhub/shared'
import { access, shell } from '@renderer/api'
import { Alert, AlertDescription } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { useEditors } from '@renderer/features/editors/use-editors'
import { useShells } from '@renderer/features/terminal/use-shells'
import {
  fontSizeRange,
  scrollbackRange,
  terminalPrefs
} from '@renderer/features/terminal/terminal-prefs'
import { appearance, type ThemePreference } from '@renderer/lib/appearance'
import { CustomShellsEditor } from './custom-shells-editor'
import { RemoteSection } from './remote-section'
import { StylePicker } from './style-picker'
import { UpdatesSection } from './updates-section'
import { NumberSetting, Segmented, SettingRow, SettingsSection } from './settings-controls'
import { usePreference, useSettings, useUpdateSettings } from './use-settings'

const selectClass =
  'h-8 min-w-44 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function SettingsPage({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettings()
  const update = useUpdateSettings()
  const [error, setError] = useState<string | null>(null)

  const save = (patch: SettingsPatch): void => {
    setError(null)
    update.mutate(patch, { onError: (failure) => setError(failure.message) })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="返回">
          <ArrowLeft />
        </Button>
        <h2 className="font-heading text-lg font-semibold">设置</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AppearanceSection />
          {settings.data && (
            <>
              <TerminalSection settings={settings.data} save={save} />
              {/* Core settings decide what runs on the host: changed on the desktop only. */}
              {access.manage && (
                <>
                  <CustomShellsEditor
                    shells={settings.data.customShells}
                    save={save}
                    onError={setError}
                  />
                  <EditorsSection save={save} onError={setError} />
                  <ProcessSection settings={settings.data} save={save} />
                </>
              )}
              <RemoteSection onError={setError} />
              {shell && <UpdatesSection />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AppearanceSection(): React.JSX.Element {
  const theme = usePreference(appearance, appearance.preference)
  return (
    <SettingsSection title="外观">
      <SettingRow label="主题" description="只影响这台电脑">
        <Segmented<ThemePreference>
          label="主题"
          value={theme}
          onChange={(value) => appearance.setPreference(value)}
          options={[
            { value: 'system', label: '跟随系统' },
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' }
          ]}
        />
      </SettingRow>
      <SettingRow label="风格" description="配色、圆角和字体；终端配色一起切换">
        <StylePicker />
      </SettingRow>
    </SettingsSection>
  )
}

interface SectionProps {
  settings: Settings
  save: (patch: SettingsPatch) => void
}

function TerminalSection({ settings, save }: SectionProps): React.JSX.Element {
  const shells = useShells()
  const fontSize = usePreference(terminalPrefs, () => terminalPrefs.fontSize())
  const scrollback = usePreference(terminalPrefs, () => terminalPrefs.scrollback())
  const webgl = usePreference(terminalPrefs, () => terminalPrefs.useWebgl())

  return (
    <SettingsSection title="终端">
      {access.manage && (
        <SettingRow
          label="默认 shell"
          htmlFor="settings-default-shell"
          description="「+」新建终端时使用；其他 shell 仍可从旁边的下拉菜单选择"
        >
          <select
            id="settings-default-shell"
            className={selectClass}
            value={settings.defaultShell ?? ''}
            onChange={(event) => {
              const shellId = shells.data?.find((s) => s.id === event.target.value)?.id ?? null
              save({ defaultShell: shellId })
            }}
          >
            <option value="">自动（优先 bash）</option>
            {shells.data?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </SettingRow>
      )}
      <SettingRow
        label="字号"
        htmlFor="settings-font-size"
        description="也可以在终端里按 Ctrl+= / Ctrl+- / Ctrl+0 调整"
      >
        <NumberSetting
          id="settings-font-size"
          value={fontSize}
          {...fontSizeRange}
          unit="px"
          onCommit={(value) => terminalPrefs.setFontSize(value)}
        />
      </SettingRow>
      <SettingRow
        label="回滚行数"
        htmlFor="settings-scrollback"
        description="每个终端保留的历史行数，越多越占内存"
      >
        <NumberSetting
          id="settings-scrollback"
          value={scrollback}
          {...scrollbackRange}
          step={1000}
          unit="行"
          onCommit={(value) => terminalPrefs.setScrollback(value)}
        />
      </SettingRow>
      <SettingRow
        label="GPU 渲染"
        description="大量输出时更流畅；显卡驱动有问题（花屏、黑屏）时关闭"
      >
        <Segmented
          label="GPU 渲染"
          value={webgl ? 'on' : 'off'}
          onChange={(value) => terminalPrefs.setUseWebgl(value === 'on')}
          options={[
            { value: 'on', label: '开启' },
            { value: 'off', label: '关闭' }
          ]}
        />
      </SettingRow>
    </SettingsSection>
  )
}

function EditorsSection({
  save,
  onError
}: {
  save: (patch: SettingsPatch) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const editors = useEditors()

  const choose = async (editor: EditorId, name: string): Promise<void> => {
    try {
      const path = await shell?.pickFile(`选择 ${name} 的可执行文件`)
      if (path) save({ editorPaths: { [editor]: path } })
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <SettingsSection title="编辑器">
      {editors.data?.map((editor) => (
        <SettingRow
          key={editor.id}
          label={editor.name}
          description={
            <span className="break-all" title={editor.path ?? undefined}>
              {editor.path
                ? `${editor.custom ? '手动指定' : '自动检测'}：${editor.path}`
                : '未检测到，可手动指定可执行文件'}
            </span>
          }
        >
          {shell && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void choose(editor.id, editor.name)}
              aria-label={`选择 ${editor.name} 的路径`}
            >
              选择…
            </Button>
          )}
          {editor.custom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => save({ editorPaths: { [editor.id]: null } })}
              aria-label={`${editor.name} 恢复自动检测`}
            >
              恢复自动检测
            </Button>
          )}
        </SettingRow>
      ))}
    </SettingsSection>
  )
}

function ProcessSection({ settings, save }: SectionProps): React.JSX.Element {
  return (
    <SettingsSection title="进程">
      <SettingRow
        label="停止等待时间"
        htmlFor="settings-grace"
        description="停止脚本时先发送 Ctrl+C，超过这个时间仍未退出就强制结束整个进程树"
      >
        <NumberSetting
          id="settings-grace"
          value={settings.stopGraceSeconds}
          min={1}
          max={60}
          unit="秒"
          onCommit={(value) => save({ stopGraceSeconds: value })}
        />
      </SettingRow>
      <SettingRow
        label="关闭窗口时"
        description={
          settings.closeAction === 'tray'
            ? '窗口隐藏到托盘，脚本和终端继续运行'
            : '退出 DevHub，并停止所有脚本和终端'
        }
      >
        <Segmented
          label="关闭窗口时"
          value={settings.closeAction}
          onChange={(value) => save({ closeAction: value })}
          options={[
            { value: 'tray', label: '最小化到托盘' },
            { value: 'quit', label: '退出' }
          ]}
        />
      </SettingRow>
    </SettingsSection>
  )
}
