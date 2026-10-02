import { describe, expect, it } from 'vitest'
import { DevhubError, type GroupInput, type Project } from '@devhub/shared'
import type { JsonStore } from '../storage/json-store'
import { createGroupService, emptyGroupsFile, type GroupsFile } from './group-service'

const memoryStore = (initial: GroupsFile = emptyGroupsFile()) => {
  let saved = structuredClone(initial)
  const store: JsonStore<GroupsFile> & { saved: () => GroupsFile } = {
    read: async () => structuredClone(saved),
    write: async (value) => {
      saved = structuredClone(value)
    },
    saved: () => saved
  }
  return store
}

const project = (id: string): Project => ({
  id,
  name: id,
  path: `/${id}`,
  addedAt: '2026-10-02T00:00:00.000Z'
})

const makeService = (store = memoryStore()) => {
  let next = 0
  return createGroupService({
    store,
    projects: {
      async get(id) {
        if (id !== 'web' && id !== 'api') {
          throw new DevhubError('PROJECT_NOT_FOUND', '项目不存在或已被移除')
        }
        return project(id)
      }
    },
    newId: () => `id-${++next}`
  })
}

const input: GroupInput = {
  name: 'front1',
  mode: 'serial',
  steps: [
    {
      projectId: 'api',
      scriptId: 'gradle:bootRun',
      continueWhen: { type: 'port', port: 8080, timeoutSeconds: 120 }
    },
    {
      projectId: 'web',
      scriptId: 'npm:dev',
      continueWhen: { type: 'output', text: 'ready', timeoutSeconds: 60 }
    }
  ]
}

describe('createGroupService', () => {
  it('creates a group across projects and persists it', async () => {
    const store = memoryStore()
    const group = await makeService(store).save(input)
    expect(group).toEqual({
      id: 'id-1',
      name: 'front1',
      mode: 'serial',
      steps: [
        { id: 'id-2', ...input.steps[0] },
        { id: 'id-3', ...input.steps[1] }
      ]
    })
    expect(store.saved().groups).toEqual([group])
  })

  it('updates a group in place when the input has an id', async () => {
    const service = makeService()
    const created = await service.save(input)
    const updated = await service.save({
      ...input,
      id: created.id,
      name: 'front2',
      mode: 'parallel'
    })
    expect(updated).toMatchObject({ id: created.id, name: 'front2', mode: 'parallel' })
    await expect(service.list()).resolves.toEqual([updated])
  })

  it('rejects a second group with the same name', async () => {
    const service = makeService()
    await service.save(input)
    await expect(service.save(input)).rejects.toMatchObject({ code: 'GROUP_NAME_TAKEN' })
  })

  it('allows keeping the name when updating', async () => {
    const service = makeService()
    const created = await service.save(input)
    await expect(service.save({ ...input, id: created.id })).resolves.toMatchObject({
      name: 'front1'
    })
  })

  it('rejects steps of unknown projects', async () => {
    const steps = [{ ...input.steps[0]!, projectId: 'gone' }]
    await expect(makeService().save({ ...input, steps })).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND'
    })
  })

  it.each([[{ ...input, steps: [] }], [{ ...input, name: '' }], [null]])(
    'rejects invalid input %#',
    async (bad) => {
      await expect(makeService().save(bad)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
  )

  it('deletes a group and rejects unknown ids', async () => {
    const store = memoryStore()
    const service = makeService(store)
    const created = await service.save(input)
    await service.remove(created.id)
    expect(store.saved().groups).toEqual([])
    await expect(service.remove(created.id)).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' })
    await expect(service.get('nope')).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' })
    await expect(service.save({ ...input, id: 'nope' })).rejects.toMatchObject({
      code: 'GROUP_NOT_FOUND'
    })
  })
})
