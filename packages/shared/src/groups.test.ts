import { describe, expect, it } from 'vitest'
import {
  continueConditionSchema,
  groupInputSchema,
  groupRunStateSchema,
  groupSchema,
  sortGroups,
  type Group
} from './groups'

const group = (id: string, pinnedAt?: string): Group => ({
  id,
  name: id,
  mode: 'parallel',
  steps: [],
  ...(pinnedAt ? { pinnedAt } : {})
})

describe('groupSchema and sorting', () => {
  it('loads older groups without a pin', () => {
    const legacy = group('legacy')
    expect(groupSchema.parse(legacy)).toEqual(legacy)
  })

  it('loads legacy steps without an execution kind', () => {
    const legacy = {
      id: 'legacy',
      name: 'legacy',
      mode: 'parallel',
      steps: [
        {
          id: 's1',
          projectId: 'p1',
          scriptId: 'npm:dev',
          continueWhen: { type: 'delay', seconds: 0 }
        }
      ]
    }
    expect(groupSchema.parse(legacy)).toEqual(legacy)
  })

  it('sorts pins newest first, then active groups, then keeps storage order', () => {
    const groups = [
      group('idle-a'),
      group('pinned-old', '2026-01-01T00:00:00.000Z'),
      group('active'),
      group('pinned-new', '2026-01-02T00:00:00.000Z'),
      group('idle-b')
    ]

    expect(sortGroups(groups, new Set(['active'])).map((candidate) => candidate.id)).toEqual([
      'pinned-new',
      'pinned-old',
      'active',
      'idle-a',
      'idle-b'
    ])
  })

  it('sorts groups by name ascending and descending keeping pins first', () => {
    const gA = group('alpha')
    const gB = group('beta')
    const gC = group('charlie', '2026-01-01T00:00:00.000Z')

    const asc = sortGroups([gB, gA, gC], new Set(), { order: 'name-asc' })
    expect(asc.map((g) => g.id)).toEqual(['charlie', 'alpha', 'beta'])

    const desc = sortGroups([gA, gB, gC], new Set(), { order: 'name-desc' })
    expect(desc.map((g) => g.id)).toEqual(['charlie', 'beta', 'alpha'])
  })

  it('sorts groups by recent activity', () => {
    const g1 = group('never-run')
    const g2 = group('ran-yesterday')
    const g3 = group('ran-today')
    const gActive = group('running-now')
    const gPinned = group('pinned', '2026-01-01T00:00:00.000Z')

    const states = [
      {
        groupId: 'ran-yesterday',
        status: 'done' as const,
        finishedAt: '2026-01-01T10:00:00.000Z',
        steps: []
      },
      {
        groupId: 'ran-today',
        status: 'done' as const,
        finishedAt: '2026-01-02T10:00:00.000Z',
        steps: []
      }
    ]

    const sorted = sortGroups([g1, g2, g3, gActive, gPinned], new Set(['running-now']), {
      order: 'recent',
      states
    })

    expect(sorted.map((g) => g.id)).toEqual([
      'pinned',
      'running-now',
      'ran-today',
      'ran-yesterday',
      'never-run'
    ])
  })
})

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
    executionKind: 'persistent',
    continueWhen: { type: 'output', text: 'ready', timeoutSeconds: 120 }
  } as const

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

  it.each([
    ['a missing execution kind', { ...step, executionKind: undefined }],
    [
      'a one-shot readiness condition',
      { ...step, executionKind: 'oneShot', continueWhen: step.continueWhen }
    ],
    [
      'a persistent exit condition',
      {
        ...step,
        executionKind: 'persistent',
        continueWhen: { type: 'exit', timeoutSeconds: 120 }
      }
    ]
  ])('rejects %s', (_label, invalidStep) => {
    expect(
      groupInputSchema.safeParse({ name: 'g', mode: 'serial', steps: [invalidStep] }).success
    ).toBe(false)
  })

  it('accepts a one-shot exit condition', () => {
    expect(
      groupInputSchema.safeParse({
        name: 'build',
        mode: 'parallel',
        steps: [
          {
            ...step,
            executionKind: 'oneShot',
            continueWhen: { type: 'exit', timeoutSeconds: 120 }
          }
        ]
      }).success
    ).toBe(true)
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
