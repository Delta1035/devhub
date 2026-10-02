// Claude Code Stop hook: before the AI declares a task done, run typecheck + tests.
// Exit code 2 blocks the stop and sends the failure back to the AI.
import { execSync } from 'node:child_process'

const input = JSON.parse(
  await new Promise((done) => {
    let data = ''
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => done(data || '{}'))
  })
)

// Already retried once after a failure: let the AI stop and report instead of looping.
if (input.stop_hook_active) process.exit(0)

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const changed = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim()
if (!changed) process.exit(0)

try {
  execSync('pnpm typecheck && pnpm test', { cwd: root, encoding: 'utf8', stdio: 'pipe' })
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.split('\n').slice(-60).join('\n')
  process.stderr.write(
    `Quality gate failed (pnpm typecheck && pnpm test). Fix before finishing:\n${output}`
  )
  process.exit(2)
}
