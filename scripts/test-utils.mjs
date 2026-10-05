import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com'
}

/** A temporary directory removed after the test. */
export function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'devhub-scripts-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** A temporary git repository with hooks disabled and a fixed identity. */
export function tempRepo(t) {
  const dir = tempDir(t)
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '-q')
  git('config', 'core.hooksPath', '.no-hooks')
  const commit = (message) => git('commit', '-q', '--allow-empty', '--no-verify', '-m', message)
  return { dir, git, commit }
}
