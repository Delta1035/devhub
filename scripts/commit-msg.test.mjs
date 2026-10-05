import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkMessage, cleanMessage, parseCommit } from './commit-msg.mjs'
import { tempDir, tempRepo } from './test-utils.mjs'

const script = fileURLToPath(new URL('./commit-msg.mjs', import.meta.url))

const run = (args, cwd) =>
  spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', windowsHide: true })

test('accepts Conventional Commits headers with optional scope, ! and body', () => {
  for (const message of [
    'feat: add batch tasks',
    'fix(desktop): stop the whole process tree',
    'chore(deps-dev): bump vitest from 4.1.11 to 5.0.2',
    'refactor(core)!: rename the run API\n\nBREAKING CHANGE: runScript takes an id',
    'ci: keep Electron caches under runner.temp',
    'Merge pull request #3 from Delta1035/dependabot/npm_and_yarn/x',
    'Revert "feat: add batch tasks"'
  ]) {
    assert.deepEqual(checkMessage(message), [], message)
  }
})

test('rejects messages that do not follow the convention', () => {
  const cases = [
    ['', /empty/],
    ['add batch tasks', /does not match/],
    ['Feat: add batch tasks', /does not match/],
    ['feat:add batch tasks', /does not match/],
    ['feat(): add batch tasks', /does not match/],
    ['feat: ', /does not match/],
    ['feature: add batch tasks', /unknown type "feature"/],
    [`feat: ${'x'.repeat(100)}`, /within 100/],
    ['feat: add batch tasks\nmore text', /blank line/]
  ]
  for (const [message, pattern] of cases) {
    const problems = checkMessage(message)
    assert.ok(
      problems.some((problem) => pattern.test(problem)),
      `${message}: ${problems.join('; ')}`
    )
  }
})

test('autosquash commits pass locally but not in CI', () => {
  assert.deepEqual(checkMessage('fixup! feat: x', { allowAutosquash: true }), [])
  assert.match(checkMessage('fixup! feat: x')[0], /squashed/)
  assert.match(checkMessage('squash! feat: x')[0], /squashed/)
})

test('strips git comments and everything below the scissors line', () => {
  const text = [
    'fix: keep logs',
    '',
    'Body.',
    '# Please enter the commit message',
    '# ------------------------ >8 ------------------------',
    'diff --git a/x b/x'
  ].join('\n')
  assert.equal(cleanMessage(text), 'fix: keep logs\n\nBody.')
  assert.equal(cleanMessage('# only comments\n\n'), '')
})

test('parses type, scope, subject and breaking changes', () => {
  assert.deepEqual(parseCommit('feat(desktop): add tabs\n\nWhy.'), {
    type: 'feat',
    scope: 'desktop',
    subject: 'add tabs',
    breaking: false
  })
  assert.equal(parseCommit('feat!: drop Node 20').breaking, true)
  assert.equal(parseCommit('fix: x\n\nBREAKING CHANGE: config moved').breaking, true)
  assert.equal(parseCommit('Merge branch main'), null)
  assert.equal(parseCommit('feature: x'), null)
})

test('CLI checks a message file the way the commit-msg hook calls it', (t) => {
  const dir = tempDir(t)
  const file = join(dir, 'COMMIT_EDITMSG')
  writeFileSync(file, 'fix: keep logs\n# comment\n')
  assert.equal(run([file], dir).status, 0)
  writeFileSync(file, 'updated stuff\n')
  const rejected = run([file], dir)
  assert.equal(rejected.status, 1)
  assert.match(rejected.stderr, /Commit message rejected/)
  assert.equal(run([], dir).status, 2)
})

test('CLI --range rejects any non-conforming commit in the range', (t) => {
  const { dir, git, commit } = tempRepo(t)
  commit('chore: init')
  const base = git('rev-parse', 'HEAD')
  commit('feat: good one')
  assert.equal(run(['--range', `${base}..HEAD`], dir).status, 0)
  commit('wip')
  const result = run(['--range', `${base}..HEAD`], dir)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /wip/)
  assert.doesNotMatch(result.stderr, /good one/)
  assert.equal(run(['--range', 'missing..HEAD'], dir).status, 1)
})
