import { isAbsolute } from 'path'
import { z } from 'zod'
import {
  DevhubError,
  defaultSettings,
  settingsPatchSchema,
  settingsSchema,
  type DevhubEvent,
  type Settings
} from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'

export const settingsFileSchema = z.object({ version: z.literal(1), settings: settingsSchema })
export type SettingsFile = z.infer<typeof settingsFileSchema>
export const emptySettingsFile = (): SettingsFile => ({
  version: 1,
  settings: structuredClone(defaultSettings)
})

export interface SettingsService {
  get(): Promise<Settings>
  update(patch: unknown): Promise<Settings>
}

export interface SettingsServiceDeps {
  store: JsonStore<SettingsFile>
  /** True when the path is an existing regular file. */
  isFile: (path: string) => Promise<boolean>
  emit: (event: DevhubEvent) => void
}

/** Settings are small and read often (every launch of a shell), so they live in memory. */
export function createSettingsService({
  store,
  isFile,
  emit
}: SettingsServiceDeps): SettingsService {
  let cache: Settings | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const load = async (): Promise<Settings> => (cache ??= (await store.read()).settings)

  return {
    async get() {
      return structuredClone(await load())
    },

    update(rawPatch) {
      const next = queue.then(async () => {
        const parsed = settingsPatchSchema.safeParse(rawPatch)
        if (!parsed.success) throw new DevhubError('SETTINGS_INVALID', '设置的值无效')
        const patch = parsed.data

        // Editor and shell paths make DevHub launch that program, so each must be a real file.
        const programs = [
          ...Object.values(patch.editorPaths ?? {}),
          ...(patch.customShells ?? []).map((shell) => shell.path)
        ]
        for (const path of programs) {
          if (path === null || path === undefined) continue
          if (!isAbsolute(path) || !(await isFile(path))) {
            throw new DevhubError('SETTINGS_INVALID', `找不到这个程序：${path}`)
          }
        }
        const shellIds = (patch.customShells ?? []).map((shell) => shell.id)
        if (new Set(shellIds).size !== shellIds.length) {
          throw new DevhubError('SETTINGS_INVALID', '自定义 shell 的 id 重复')
        }

        const current = await load()
        const settings: Settings = {
          ...current,
          ...patch,
          editorPaths: { ...current.editorPaths, ...patch.editorPaths }
        }
        await store.write({ version: 1, settings })
        cache = settings
        emit({ type: 'settings-updated', settings: structuredClone(settings) })
        return structuredClone(settings)
      })
      queue = next.catch(() => undefined)
      return next
    }
  }
}
