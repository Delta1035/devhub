import { describe, expect, it } from 'vitest'
import { runRecordSchema, runHistoryOutputSchema, runHistoryOutputLimit } from './history'

const legacy = {
  runId: 'r',
  projectId: 'p',
  scriptId: 'npm:dev',
  command: 'npm run dev',
  startedAt: '2026-10-03T10:00:00.000Z',
  endedAt: '2026-10-03T10:01:00.000Z',
  exitCode: 0,
  stopped: false
}

describe('history contracts', () => {
  it('reads existing history as finished without discarding its result', () => {
    expect(runRecordSchema.parse(legacy)).toEqual({ ...legacy, status: 'finished' })
  })
  it('supports interrupted records with unknown end time and code', () => {
    expect(
      runRecordSchema.parse({ ...legacy, status: 'interrupted', endedAt: null, exitCode: null })
    ).toMatchObject({ status: 'interrupted', endedAt: null, exitCode: null })
    expect(runRecordSchema.safeParse({ ...legacy, status: 'invalid' }).success).toBe(false)
  })
  it('bounds historical output and requires truncation information', () => {
    expect(runHistoryOutputSchema.safeParse({ data: '', truncated: false }).success).toBe(true)
    expect(
      runHistoryOutputSchema.safeParse({
        data: 'x'.repeat(runHistoryOutputLimit + 1),
        truncated: true
      }).success
    ).toBe(false)
    expect(runHistoryOutputSchema.safeParse({ data: 'x' }).success).toBe(false)
  })
})
