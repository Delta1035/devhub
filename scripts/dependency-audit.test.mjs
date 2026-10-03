import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditCommand, auditSummary } from './dependency-audit.mjs'

const report = (advisories = {}) => ({
  advisories,
  metadata: {
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: Object.keys(advisories).length,
      critical: 0
    }
  }
})
const result = (value, status = 0) => ({ status, stdout: JSON.stringify(value), stderr: '' })
const advisory = {
  module_name: 'braces',
  severity: 'high',
  github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
  findings: [{ paths: ['desktop>shadcn>braces'] }]
}

test('uses a static cmd command on Windows and direct pnpm on Linux', () => {
  assert.deepEqual(auditCommand('win32'), ['cmd.exe', ['/d', '/s', '/c', 'pnpm audit --json']])
  assert.deepEqual(auditCommand('linux'), ['pnpm', ['audit', '--json']])
})

test('accepts a successful audit with no vulnerabilities', () => {
  assert.match(auditSummary(result(report())), /high: 0/)
})

test('reports a high advisory without failing for audit exit 1', () => {
  const summary = auditSummary(result(report({ 1240992: advisory }), 1))
  assert.match(summary, /high: 1/)
  assert.match(summary, /https:\/\/github.com\/advisories\/GHSA-vfj7-8cjw-p6xm/)
  assert.match(summary, /desktop>shadcn>braces/)
})

test('registry error fails even when an otherwise valid report is present', () => {
  assert.throws(() => auditSummary(result({ ...report(), error: { code: 'ECONNRESET' } }, 1)))
})

test('invalid JSON, missing fields and malformed advisories fail', () => {
  assert.throws(() => auditSummary({ status: 0, stdout: 'not json' }))
  assert.throws(() => auditSummary(result({ advisories: {} })))
  assert.throws(() =>
    auditSummary(result({ ...report(), metadata: { vulnerabilities: { high: 0 } } }))
  )
  assert.throws(() => auditSummary(result(report({ bad: { ...advisory, findings: null } }), 1)))
  assert.throws(() =>
    auditSummary(result(report({ bad: { ...advisory, github_advisory_id: 'bad' } }), 1))
  )
})

test('process errors, unexpected exit codes, signals and empty exit 1 reports fail', () => {
  assert.throws(
    () => auditSummary({ ...result(report()), error: new Error('ETIMEDOUT') }),
    /ETIMEDOUT/
  )
  assert.throws(() => auditSummary(result(report(), 2)), /process failed/)
  assert.throws(() => auditSummary({ ...result(report()), signal: 'SIGTERM' }), /process failed/)
  assert.throws(() => auditSummary(result(report(), 1)), /without reporting advisories/)
})
