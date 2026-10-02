import { describe, expect, it } from 'vitest'
import { defaultSettings, type DevhubEvent } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import { createSettingsService, emptySettingsFile, type SettingsFile } from './settings-service'

const memoryStore = () => {
  let saved = emptySettingsFile()
  const store: JsonStore<SettingsFile> & { saved: () => SettingsFile } = {
    read: async () => structuredClone(saved),
    write: async (value) => {
      saved = structuredClone(value)
    },
    saved: () => saved
  }
  return store
}

const ideaPath = process.platform === 'win32' ? 'D:\\IDEA\\bin\\idea64.exe' : '/opt/idea/bin/idea'

const makeService = () => {
  const store = memoryStore()
  const events: DevhubEvent[] = []
  const service = createSettingsService({
    store,
    isFile: async (path) => path === ideaPath,
    emit: (event) => events.push(event)
  })
  return { store, events, service }
}

describe('createSettingsService', () => {
  it('starts with the defaults', async () => {
    await expect(makeService().service.get()).resolves.toEqual(defaultSettings)
  })

  it('applies a partial update, persists it and announces it', async () => {
    const { store, events, service } = makeService()
    const updated = await service.update({ stopGraceSeconds: 10, closeAction: 'quit' })
    expect(updated).toEqual({ ...defaultSettings, stopGraceSeconds: 10, closeAction: 'quit' })
    expect(store.saved().settings).toEqual(updated)
    expect(events).toEqual([{ type: 'settings-updated', settings: updated }])
  })

  it('merges editor paths one at a time and clears them with null', async () => {
    const { service } = makeService()
    await service.update({ editorPaths: { idea: ideaPath } })
    await expect(service.get()).resolves.toMatchObject({
      editorPaths: { vscode: null, idea: ideaPath }
    })
    await service.update({ editorPaths: { idea: null } })
    await expect(service.get()).resolves.toMatchObject({ editorPaths: { idea: null } })
  })

  it.each([['relative/idea.exe'], [process.platform === 'win32' ? 'C:\\nope.exe' : '/nope']])(
    'rejects an editor path that is not an existing absolute file: %s',
    async (path) => {
      const { store, service } = makeService()
      await expect(service.update({ editorPaths: { vscode: path } })).rejects.toMatchObject({
        code: 'SETTINGS_INVALID'
      })
      expect(store.saved()).toEqual(emptySettingsFile())
    }
  )

  it.each([[{ stopGraceSeconds: 0 }], [{ defaultShell: 'tcsh' }], [null], ['x']])(
    'rejects invalid values %o',
    async (patch) => {
      await expect(makeService().service.update(patch)).rejects.toMatchObject({
        code: 'SETTINGS_INVALID'
      })
    }
  )

  it('returns copies, so callers cannot change the stored settings', async () => {
    const { service } = makeService()
    const settings = await service.get()
    settings.stopGraceSeconds = 42
    await expect(service.get()).resolves.toMatchObject({ stopGraceSeconds: 5 })
  })

  it('applies concurrent updates in order', async () => {
    const { service } = makeService()
    await Promise.all([
      service.update({ stopGraceSeconds: 7 }),
      service.update({ closeAction: 'quit' })
    ])
    await expect(service.get()).resolves.toMatchObject({ stopGraceSeconds: 7, closeAction: 'quit' })
  })
})

describe('createSettingsService custom shells', () => {
  const shell = (id: string, path: string) => ({ id, name: id, path, args: [] })

  it('saves custom shells whose programs exist', async () => {
    const { service } = makeService()
    await expect(
      service.update({ customShells: [shell('custom-a', ideaPath)] })
    ).resolves.toMatchObject({ customShells: [shell('custom-a', ideaPath)] })
  })

  it('rejects a missing program and duplicate ids', async () => {
    const { service } = makeService()
    await expect(
      service.update({ customShells: [shell('custom-a', '/missing/shell')] })
    ).rejects.toMatchObject({ code: 'SETTINGS_INVALID' })
    await expect(
      service.update({ customShells: [shell('custom-a', ideaPath), shell('custom-a', ideaPath)] })
    ).rejects.toMatchObject({ code: 'SETTINGS_INVALID', message: '自定义 shell 的 id 重复' })
  })

  it('keeps custom shells when other settings change', async () => {
    const { service } = makeService()
    await service.update({ customShells: [shell('custom-a', ideaPath)] })
    await service.update({ stopGraceSeconds: 8 })
    await expect(service.get()).resolves.toMatchObject({
      customShells: [shell('custom-a', ideaPath)]
    })
  })
})
