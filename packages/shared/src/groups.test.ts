import { describe, expect, it } from 'vitest'
import { continueConditionSchema, groupInputSchema, groupRunStateSchema } from './groups'

describe('groupRunStateSchema', () => {
  it('loads older results without execution snapshots or reuse information', () => {
    const state = {
      groupId: 'g',
      status: 'done',
      steps: [{ stepId: 's', state: 'done', runId: 'r' }]
    }
    expect(groupRunStateSchema.parse(state)).toEqual(state)
  })

  it('preserves and validates execution snapshots and reuse information', () => {
    const state = {
      groupId: 'g',
      status: 'done',
      group: {
        id: 'g',
        name: 'g',
        mode: 'parallel',
        steps: [
          {
            id: 's',
            projectId: 'p',
            scriptId: 'npm:dev',
            continueWhen: { type: 'delay', seconds: 0 }
          }
        ]
      },
      steps: [{ stepId: 's', state: 'done', runId: 'r', reused: true }]
    }
    expect(groupRunStateSchema.parse(state)).toEqual(state)
    expect(
      groupRunStateSchema.safeParse({ ...state, group: { ...state.group, mode: 'invalid' } })
        .success
    ).toBe(false)
    expect(
      groupRunStateSchema.safeParse({ ...state, steps: [{ ...state.steps[0], reused: 'yes' }] })
        .success
    ).toBe(false)
  })
})

describe('groupInputSchema', () => {
  const step = {
    projectId: 'p1',
    scriptId: 'npm:dev',
    continueWhen: { type: 'output', text: 'ready', timeoutSeconds: 120 }
  }

  it('accepts a serial group across projects', () => {
    const parsed = groupInputSchema.parse({
      name: '  front1  ',
      mode: 'serial',
      steps: [step, { ...step, projectId: 'p2', continueWhen: { type: 'delay', seconds: 3 } }]
    })
    expect(parsed.name).toBe('front1')
    expect(parsed.steps).toHaveLength(2)
  })

  it.each([
    ['an empty name', { name: ' ', mode: 'parallel', steps: [step] }],
    ['no steps', { name: 'g', mode: 'parallel', steps: [] }],
    ['an unknown mode', { name: 'g', mode: 'random', steps: [step] }]
  ])('rejects %s', (_label, input) => {
    expect(groupInputSchema.safeParse(input).success).toBe(false)
  })
})

describe('continueConditionSchema', () => {
  it.each([
    [{ type: 'exit', timeoutSeconds: 60 }],
    [{ type: 'output', text: 'Started Application', timeoutSeconds: 120 }],
    [{ type: 'port', port: 8080, timeoutSeconds: 120 }],
    [{ type: 'http', url: 'http://localhost:8080/actuator/health', timeoutSeconds: 120 }],
    [{ type: 'http', url: 'https://api.example.test/healthz', timeoutSeconds: 120 }],
    [{ type: 'delay', seconds: 0 }]
  ])('accepts %o', (condition) => {
    expect(continueConditionSchema.safeParse(condition).success).toBe(true)
  })

  it.each([
    [{ type: 'output', text: '', timeoutSeconds: 120 }],
    [{ type: 'port', port: 70000, timeoutSeconds: 120 }],
    [{ type: 'exit', timeoutSeconds: 0 }],
    [{ type: 'delay', seconds: -1 }],
    [{ type: 'http' }],
    [{ type: 'http', url: 'localhost:8080', timeoutSeconds: 120 }],
    [{ type: 'http', url: 'file:///etc/passwd', timeoutSeconds: 120 }],
    [{ type: 'http', url: 'javascript:alert(1)', timeoutSeconds: 120 }]
  ])('rejects %o', (condition) => {
    expect(continueConditionSchema.safeParse(condition).success).toBe(false)
  })
})

describe('http condition', () => {
  it('explains a URL without http:// or https://', () => {
    const parsed = continueConditionSchema.safeParse({
      type: 'http',
      url: 'localhost:8080/health',
      timeoutSeconds: 120
    })
    expect(parsed.error?.issues[0]?.message).toBe('请填写 http:// 或 https:// 开头的地址')
  })
})

describe('output condition regex', () => {
  it('accepts a valid regex and rejects an invalid one', () => {
    const base = { type: 'output', timeoutSeconds: 60, regex: true }
    const text = String.raw`Started .* in \d+`
    expect(continueConditionSchema.safeParse({ ...base, text }).success).toBe(true)
    expect(continueConditionSchema.safeParse({ ...base, text: 'ready (' }).success).toBe(false)
  })

  it('does not validate plain text as a regex', () => {
    expect(
      continueConditionSchema.safeParse({ type: 'output', text: 'ready (', timeoutSeconds: 60 })
        .success
    ).toBe(true)
  })
})
