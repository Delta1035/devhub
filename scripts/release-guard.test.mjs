import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { releaseProblems } from './release-guard.mjs'
import { tempDir, tempRepo } from './test-utils.mjs'

/** A repository on main that matches its `origin` remote, with v1.0.0 tagged on main. */
function publishedRepo(t) {
  const repo = tempRepo(t)
  const origin = tempDir(t)
  repo.git('init', '-q', '--bare', origin)
  repo.git('checkout', '-q', '-b', 'main')
  repo.commit('feat: first')
  repo.git('tag', 'v1.0.0')
  repo.git('remote', 'add', 'origin', origin)
  repo.git('push', '-q', '--tags', 'origin', 'main')
  return repo
}

const problems = (repo) => releaseProblems({ cwd: repo.dir })

test('allows a release from a clean main that matches origin', (t) => {
  assert.deepEqual(problems(publishedRepo(t)), [])
})

test('refuses another branch or a detached HEAD', (t) => {
  const repo = publishedRepo(t)
  repo.git('checkout', '-q', '-b', 'feature')
  assert.match(problems(repo).join('\n'), /Release from main, not feature\./)
  repo.git('checkout', '-q', '--detach')
  assert.match(problems(repo).join('\n'), /not a detached HEAD/)
})

test('refuses uncommitted changes', (t) => {
  const repo = publishedRepo(t)
  writeFileSync(join(repo.dir, 'notes.txt'), 'draft')
  assert.deepEqual(problems(repo), ['Commit or stash your changes first.'])
})

test('refuses a main that is ahead of or behind origin', (t) => {
  const repo = publishedRepo(t)
  repo.commit('fix: local only')
  assert.match(problems(repo).join('\n'), /1 ahead and 0 behind origin\/main/)
  repo.git('push', '-q', 'origin', 'main')
  repo.git('reset', '-q', '--hard', 'HEAD~1')
  assert.match(problems(repo).join('\n'), /0 ahead and 1 behind origin\/main/)
})

test('refuses when the latest tag is not in the history', (t) => {
  const repo = publishedRepo(t)
  // Tagged on a branch whose changes reached main through a squash.
  repo.git('checkout', '-q', '-b', 'feature')
  repo.commit('chore(release): v1.1.0')
  repo.git('tag', 'v1.1.0')
  repo.git('checkout', '-q', 'main')
  repo.git('branch', '-q', '-D', 'feature')
  assert.deepEqual(problems(repo), [
    "The latest tag v1.1.0 is not in HEAD's history; merge it into main."
  ])
  repo.git('merge', '-q', '-s', 'ours', '--no-ff', '-m', 'merge v1.1.0', 'v1.1.0')
  repo.git('push', '-q', 'origin', 'main')
  assert.deepEqual(problems(repo), [])
})

test('reports a remote that cannot be fetched', (t) => {
  const repo = publishedRepo(t)
  repo.git('remote', 'set-url', 'origin', join(repo.dir, 'missing'))
  assert.match(problems(repo).join('\n'), /Could not fetch origin\/main/)
})
