import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  changelogHeader,
  extractSection,
  main,
  prependSection,
  releaseChangelog,
  renderSection,
  today
} from './changelog.mjs'
import { tempDir, tempRepo } from './test-utils.mjs'

const commits = [
  { hash: 'aaaaaaa1111', message: 'feat(desktop): add tabs' },
  { hash: 'bbbbbbb2222', message: 'docs: explain tabs' },
  { hash: 'ccccccc3333', message: 'fix: keep logs\n\nWhy it broke.' },
  { hash: 'ddddddd4444', message: 'refactor(core)!: rename the run API' },
  { hash: 'eeeeeee5555', message: 'Merge pull request #3 from x' },
  { hash: 'fffffff6666', message: 'feat: add groups' },
  { hash: '0000000aaaa', message: 'perf(core): buffer output' }
]

test('renders user-facing groups, newest first, and skips other types', () => {
  assert.equal(
    renderSection('v1.3.0', '2026-10-06', commits),
    [
      '## v1.3.0 - 2026-10-06',
      '',
      '### Breaking Changes',
      '',
      '- **core:** rename the run API (ddddddd)',
      '',
      '### Features',
      '',
      '- add groups (fffffff)',
      '- **desktop:** add tabs (aaaaaaa)',
      '',
      '### Fixes',
      '',
      '- keep logs (ccccccc)',
      '',
      '### Performance',
      '',
      '- **core:** buffer output (0000000)',
      ''
    ].join('\n')
  )
})

test('says so when a release has no user-facing changes', () => {
  const section = renderSection('v1.0.1', '2026-10-06', [{ hash: 'abcdef0', message: 'ci: x' }])
  assert.match(section, /No user-facing changes\./)
})

test('prepends sections below the header and refuses duplicates', () => {
  const first = prependSection('', renderSection('v1.0.0', '2026-10-01', commits.slice(0, 1)))
  assert.ok(first.startsWith(changelogHeader))
  const second = prependSection(first, renderSection('v1.1.0', '2026-10-02', commits.slice(2, 3)))
  assert.ok(second.indexOf('## v1.1.0') < second.indexOf('## v1.0.0'))
  assert.ok(second.startsWith(changelogHeader))
  assert.throws(() => prependSection(second, '## v1.1.0 - x\n'), /already has a section/)
})

test('extracts one section body without its heading', () => {
  const changelog = prependSection(
    prependSection('', renderSection('v1.0.0', '2026-10-01', commits.slice(0, 1))),
    renderSection('v1.1.0', '2026-10-02', commits.slice(2, 3))
  ).replace(/\n/g, '\r\n')
  assert.equal(extractSection(changelog, 'v1.1.0'), '### Fixes\n\n- keep logs (ccccccc)')
  assert.equal(
    extractSection(changelog, 'v1.0.0'),
    '### Features\n\n- **desktop:** add tabs (aaaaaaa)'
  )
  assert.equal(extractSection(changelog, 'v1.0'), null)
  assert.equal(extractSection(changelog, 'v2.0.0'), null)
})

test('formats today as a local YYYY-MM-DD date', () => {
  assert.equal(today(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
})

test('release adds and stages the commits since the previous tag', (t) => {
  const { dir, git, commit } = tempRepo(t)
  commit('feat: before the first release')
  releaseChangelog({ cwd: dir, version: '0.1.0', date: '2026-10-01' })
  commit('chore(release): v0.1.0')
  git('tag', 'v0.1.0')
  commit('fix(desktop): after the first release')
  commit('docs: not in the notes')

  releaseChangelog({ cwd: dir, version: '0.1.1', date: '2026-10-02' })
  assert.equal(git('diff', '--cached', '--name-only'), 'CHANGELOG.md')
  const changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')
  assert.match(
    extractSection(changelog, 'v0.1.1'),
    /^### Fixes\n\n- \*\*desktop:\*\* after the first release \([0-9a-f]{7}\)$/
  )
  assert.match(extractSection(changelog, 'v0.1.0'), /before the first release/)
  assert.doesNotMatch(extractSection(changelog, 'v0.1.1'), /before the first release/)
  assert.throws(() => releaseChangelog({ cwd: dir, version: '0.1.1' }), /already has a section/)
  assert.throws(() => releaseChangelog({ cwd: dir, version: 'patch' }), /Invalid version/)
})

test('notes command prints a section and fails when it is missing', (t) => {
  const dir = tempDir(t)
  const written = []
  const stdout = { write: (text) => written.push(text) }
  t.mock.method(console, 'error', () => {})
  assert.equal(main(['notes', 'v1.0.0'], dir, stdout), 1)
  writeFileSync(
    join(dir, 'CHANGELOG.md'),
    prependSection('', renderSection('v1.0.0', 'd', commits))
  )
  assert.equal(main(['notes', 'v1.0.0'], dir, stdout), 0)
  assert.match(written.join(''), /^### Breaking Changes\n[\s\S]*### Features/)
  assert.equal(main(['notes', 'v9.9.9'], dir, stdout), 1)
  assert.equal(main(['bogus'], dir, stdout), 2)
})
