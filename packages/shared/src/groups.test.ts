import { describe, expect, it } from 'vitest'
import { continueConditionSchema, groupInputSchema } from './groups'

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
    [{ type: 'delay', seconds: 0 }]
  ])('accepts %o', (condition) => {
    expect(continueConditionSchema.safeParse(condition).success).toBe(true)
  })

  it.each([
    [{ type: 'output', text: '', timeoutSeconds: 120 }],
    [{ type: 'port', port: 70000, timeoutSeconds: 120 }],
    [{ type: 'exit', timeoutSeconds: 0 }],
    [{ type: 'delay', seconds: -1 }],
    [{ type: 'http' }]
  ])('rejects %o', (condition) => {
    expect(continueConditionSchema.safeParse(condition).success).toBe(false)
  })
})
