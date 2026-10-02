import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { joinArgs, splitArgs, type CustomShell, type SettingsPatch } from '@devhub/shared'
import { shell as shellApi } from '@renderer/api'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { SettingsSection } from './settings-controls'

interface Draft {
  id: string
  name: string
  path: string
  args: string
}

const toDraft = (shell: CustomShell): Draft => ({ ...shell, args: joinArgs(shell.args) })
const newId = (): string => `custom-${Math.random().toString(36).slice(2, 10)}`

interface CustomShellsEditorProps {
  shells: CustomShell[]
  save: (patch: SettingsPatch) => void
  onError: (message: string) => void
}

/** Edits the list as a draft and saves it as a whole, so half-filled rows are never stored. */
export function CustomShellsEditor({
  shells,
  save,
  onError
}: CustomShellsEditorProps): React.JSX.Element {
  const [drafts, setDrafts] = useState<Draft[]>(() => shells.map(toDraft))
  const saved = JSON.stringify(shells.map(toDraft))
  const dirty = JSON.stringify(drafts) !== saved

  const update = (index: number, changes: Partial<Draft>): void =>
    setDrafts(drafts.map((draft, i) => (i === index ? { ...draft, ...changes } : draft)))

  const pickPath = async (index: number): Promise<void> => {
    try {
      const path = await shellApi?.pickFile('选择 shell 程序')
      if (path) update(index, { path })
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    }
  }

  const submit = (): void => {
    const incomplete = drafts.findIndex((draft) => !draft.name.trim() || !draft.path)
    if (incomplete !== -1)
      return onError(`第 ${incomplete + 1} 个自定义 shell：请填写名称并选择程序`)
    save({
      customShells: drafts.map((draft) => ({
        id: draft.id,
        name: draft.name.trim(),
        path: draft.path,
        args: splitArgs(draft.args)
      }))
    })
  }

  return (
    <SettingsSection title="自定义 shell">
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          添加检测不到的 shell（如 WSL、Nushell、带参数的
          PowerShell），之后可在「+」旁的菜单中选择，也可设为默认 shell。
        </p>
        {drafts.map((draft, index) => (
          <div
            key={draft.id}
            className="flex flex-wrap items-center gap-2"
            aria-label={`自定义 shell ${index + 1}`}
          >
            <Input
              aria-label="名称"
              className="h-8 w-32"
              placeholder="名称"
              value={draft.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
            <Input
              aria-label="程序路径"
              className="h-8 min-w-48 flex-1"
              placeholder="程序路径"
              value={draft.path}
              readOnly
              title={draft.path}
            />
            {shellApi && (
              <Button variant="outline" size="sm" onClick={() => void pickPath(index)}>
                选择…
              </Button>
            )}
            <Input
              aria-label="参数"
              className="h-8 w-48"
              placeholder="参数，如 -NoLogo"
              value={draft.args}
              onChange={(event) => update(index, { args: event.target.value })}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDrafts(drafts.filter((_, i) => i !== index))}
              aria-label={`删除自定义 shell ${index + 1}`}
            >
              <X />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={drafts.length >= 10}
            onClick={() => setDrafts([...drafts, { id: newId(), name: '', path: '', args: '' }])}
          >
            <Plus data-icon="inline-start" />
            添加
          </Button>
          {dirty && (
            <>
              <Button size="sm" onClick={submit}>
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDrafts(shells.map(toDraft))}>
                放弃修改
              </Button>
            </>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}
