import {
  defaultTimeoutSeconds,
  groupInputSchema,
  type ContinueCondition,
  type Group,
  type GroupInput,
  type GroupMode
} from '@devhub/shared'

export type ConditionType = ContinueCondition['type']

/** Editable form state. Inputs keep their raw text so half-typed values are not lost. */
export interface DraftStep {
  key: string
  projectId: string
  scriptId: string
  type: ConditionType
  text: string
  regex: boolean
  port: string
  url: string
  seconds: string
  timeout: string
}

export interface GroupDraft {
  id?: string
  name: string
  mode: GroupMode
  steps: DraftStep[]
}

export const conditionTypes: ConditionType[] = ['output', 'exit', 'port', 'http', 'delay']

export const conditionLabels: Record<ConditionType, string> = {
  output: '输出中出现文字',
  exit: '进程成功退出',
  port: '端口可连接',
  http: 'HTTP 返回成功',
  delay: '等待 N 秒'
}

let nextKey = 0
const key = (): string => `step-${++nextKey}`

export function emptyStep(projectId = ''): DraftStep {
  return {
    key: key(),
    projectId,
    scriptId: '',
    // Servers are the common case: wait until they print that they are ready.
    type: 'output',
    text: '',
    regex: false,
    port: '',
    url: '',
    seconds: '5',
    timeout: String(defaultTimeoutSeconds)
  }
}

export function draftFromGroup(group: Group): GroupDraft {
  return {
    id: group.id,
    name: group.name,
    mode: group.mode,
    steps: group.steps.map((step) => {
      const condition = step.continueWhen
      return {
        ...emptyStep(step.projectId),
        scriptId: step.scriptId,
        type: condition.type,
        text: condition.type === 'output' ? condition.text : '',
        regex: condition.type === 'output' && condition.regex === true,
        port: condition.type === 'port' ? String(condition.port) : '',
        url: condition.type === 'http' ? condition.url : '',
        seconds: condition.type === 'delay' ? String(condition.seconds) : '5',
        timeout:
          condition.type === 'delay'
            ? String(defaultTimeoutSeconds)
            : String(condition.timeoutSeconds)
      }
    })
  }
}

function conditionOf(step: DraftStep, mode: GroupMode): ContinueCondition {
  // Parallel groups ignore conditions; store a neutral one.
  if (mode === 'parallel') return { type: 'delay', seconds: 0 }
  const timeoutSeconds = Number(step.timeout)
  switch (step.type) {
    case 'output':
      return {
        type: 'output',
        text: step.text,
        ...(step.regex ? { regex: true } : {}),
        timeoutSeconds
      }
    case 'exit':
      return { type: 'exit', timeoutSeconds }
    case 'port':
      return { type: 'port', port: Number(step.port), timeoutSeconds }
    case 'http':
      return { type: 'http', url: step.url.trim(), timeoutSeconds }
    case 'delay':
      return { type: 'delay', seconds: Number(step.seconds) }
  }
}

/** Validates the draft with the same schema the core uses; returns a message on failure. */
export function toGroupInput(draft: GroupDraft): { input: GroupInput } | { error: string } {
  if (!draft.name.trim()) return { error: '请填写名称' }
  if (draft.steps.length === 0) return { error: '至少添加一个步骤' }
  const incomplete = draft.steps.findIndex((step) => !step.projectId || !step.scriptId)
  if (incomplete !== -1) return { error: `第 ${incomplete + 1} 步：请选择项目和脚本` }

  const input = {
    ...(draft.id ? { id: draft.id } : {}),
    name: draft.name,
    mode: draft.mode,
    steps: draft.steps.map((step) => ({
      projectId: step.projectId,
      scriptId: step.scriptId,
      continueWhen: conditionOf(step, draft.mode)
    }))
  }
  const parsed = groupInputSchema.safeParse(input)
  if (parsed.success) return { input: parsed.data }

  const index = parsed.error.issues[0]?.path[1]
  const where = typeof index === 'number' ? `第 ${index + 1} 步：` : ''
  const regexIssue = parsed.error.issues.some((issue) => issue.message === '正则表达式无效')
  if (regexIssue) return { error: `${where}正则表达式无效` }
  const urlIssue = parsed.error.issues.find((issue) => issue.path.at(-1) === 'url')
  if (urlIssue) return { error: `${where}${urlIssue.message}` }
  return { error: `${where}请检查继续条件（文字不能为空，端口 1–65535，秒数与超时为正整数）` }
}
