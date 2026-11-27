import { describe, expect, it } from 'vitest'
import type { Group } from '@devhub/shared'
import { draftFromGroup, emptyStep, toGroupInput } from './group-draft'

describe('group draft lifecycle types', () => {
  it('creates persistent steps by default', () => {
    expect(emptyStep('p1')).toMatchObject({
      projectId: 'p1',
      executionKind: 'persistent',
      legacy: false,
      type: 'output'
    })
  })

  it('stores a one-shot step with an exit condition in parallel mode', () => {
    const step = emptyStep('p1')
    step.scriptId = 'npm:build'
    step.executionKind = 'oneShot'
    step.type = 'exit'
    const result = toGroupInput({ name: 'build', mode: 'parallel', steps: [step] })
    expect(result).toEqual({
      input: {
        name: 'build',
        mode: 'parallel',
        steps: [
          {
            projectId: 'p1',
            scriptId: 'npm:build',
            executionKind: 'oneShot',
            continueWhen: { type: 'exit', timeoutSeconds: 120 }
          }
        ]
      }
    })
  })

  it('marks a legacy step for confirmation and saves an explicit inferred type', () => {
    const legacy: Group = {
      id: 'g',
      name: 'legacy',
      mode: 'serial',
      steps: [
        {
          id: 's',
          projectId: 'p1',
          scriptId: 'npm:dev',
          continueWhen: { type: 'port', port: 5173, timeoutSeconds: 60 }
        }
      ]
    }
    const draft = draftFromGroup(legacy)
    expect(draft.steps[0]).toMatchObject({ executionKind: 'persistent', legacy: true })
    expect(toGroupInput(draft)).toMatchObject({
      input: {
        steps: [{ executionKind: 'persistent', continueWhen: { type: 'port', port: 5173 } }]
      }
    })
  })
})
