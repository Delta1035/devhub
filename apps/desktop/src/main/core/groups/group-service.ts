import { randomUUID } from 'crypto'
import { z } from 'zod'
import { DevhubError, groupInputSchema, groupSchema, type Group } from '@devhub/shared'
import type { ProjectService } from '../projects/project-service'
import type { JsonStore } from '../storage/json-store'

export const groupsFileSchema = z.object({
  version: z.literal(1),
  groups: z.array(groupSchema)
})
export type GroupsFile = z.infer<typeof groupsFileSchema>

export const emptyGroupsFile = (): GroupsFile => ({ version: 1, groups: [] })

/** Stores batch-run definitions in DevHub's own data (not in any project). */
export interface GroupService {
  list(): Promise<Group[]>
  get(groupId: unknown): Promise<Group>
  save(input: unknown): Promise<Group>
  remove(groupId: unknown): Promise<void>
}

export interface GroupServiceDeps {
  store: JsonStore<GroupsFile>
  projects: Pick<ProjectService, 'get'>
  newId?: () => string
}

const idInput = z.string().min(1)

export function createGroupService({
  store,
  projects,
  newId = randomUUID
}: GroupServiceDeps): GroupService {
  let cache: GroupsFile | null = null
  // Serializes read-modify-write cycles so concurrent calls cannot lose updates.
  let queue: Promise<unknown> = Promise.resolve()

  const load = async (): Promise<GroupsFile> => (cache ??= await store.read())

  const mutate = <T>(fn: (data: GroupsFile) => Promise<T>): Promise<T> => {
    const next = queue.then(async () => {
      const data = await load()
      const result = await fn(data)
      await store.write(data)
      return result
    })
    queue = next.catch(() => undefined)
    return next
  }

  const indexOf = (data: GroupsFile, rawId: unknown): number => {
    const parsed = idInput.safeParse(rawId)
    const index = parsed.success ? data.groups.findIndex((group) => group.id === parsed.data) : -1
    if (index === -1) throw new DevhubError('GROUP_NOT_FOUND', '批量任务不存在或已被删除')
    return index
  }

  return {
    async list() {
      return [...(await load()).groups]
    },

    async get(rawId) {
      const data = await load()
      const group = data.groups[indexOf(data, rawId)]
      if (!group) throw new DevhubError('GROUP_NOT_FOUND', '批量任务不存在或已被删除')
      return group
    },

    save(rawInput) {
      return mutate(async (data) => {
        const parsed = groupInputSchema.safeParse(rawInput)
        if (!parsed.success) throw new DevhubError('INVALID_INPUT', '批量任务的内容不完整或无效')
        const input = parsed.data

        const existingIndex = input.id === undefined ? -1 : indexOf(data, input.id)
        const nameTaken = data.groups.some(
          (group, index) => index !== existingIndex && group.name === input.name
        )
        if (nameTaken)
          throw new DevhubError('GROUP_NAME_TAKEN', `已有同名的批量任务：${input.name}`)
        // Scripts are checked when the group runs (they come from files that can change);
        // projects must exist now.
        for (const step of input.steps) await projects.get(step.projectId)

        const group: Group = {
          id: input.id ?? newId(),
          name: input.name,
          mode: input.mode,
          steps: input.steps.map((step) => ({ ...step, id: newId() }))
        }
        if (existingIndex === -1) data.groups.push(group)
        else data.groups[existingIndex] = group
        return group
      })
    },

    remove(rawId) {
      return mutate(async (data) => {
        data.groups.splice(indexOf(data, rawId), 1)
      })
    }
  }
}
