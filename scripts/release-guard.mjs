import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  return { ok: result.status === 0, out: result.stdout.trim(), err: result.stderr.trim() }
}

/**
 * Reasons `pnpm release` must not run here; empty when it may. A release tags HEAD, so it has to
 * be the published main: v1.5.0 was once tagged on a feature branch that had already been
 * squash-merged, which left the tag outside main and made the next changelog repeat its commits.
 */
export function releaseProblems({ cwd, remote = 'origin', branch = 'main', fetch = true }) {
  const problems = []
  const current = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd)
  if (!current.ok || current.out !== branch) {
    problems.push(`Release from ${branch}, not ${current.ok ? current.out : 'a detached HEAD'}.`)
  }
  if (git(['status', '--porcelain'], cwd).out !== '') {
    problems.push('Commit or stash your changes first.')
  }
  const upstream = `${remote}/${branch}`
  const fetched = fetch ? git(['fetch', '--quiet', '--tags', remote, branch], cwd) : { ok: true }
  if (!fetched.ok) {
    problems.push(`Could not fetch ${upstream}: ${fetched.err}`)
  } else {
    const counts = git(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], cwd)
    const [ahead, behind] = counts.ok ? counts.out.split(/\s+/).map(Number) : [NaN, NaN]
    if (!counts.ok) problems.push(`${upstream} does not exist.`)
    else if (ahead > 0 || behind > 0) {
      problems.push(`HEAD is ${ahead} ahead and ${behind} behind ${upstream}; push or pull first.`)
    }
  }
  const [latest] = git(['tag', '--list', 'v*', '--sort=-v:refname'], cwd).out.split('\n')
  if (latest && !git(['merge-base', '--is-ancestor', latest, 'HEAD'], cwd).ok) {
    problems.push(`The latest tag ${latest} is not in HEAD's history; merge it into ${branch}.`)
  }
  return problems
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const problems = releaseProblems({ cwd: root })
  for (const problem of problems) console.error(`pnpm release: ${problem}`)
  process.exitCode = problems.length > 0 ? 1 : 0
}
