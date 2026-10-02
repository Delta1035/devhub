// Claude Code PostToolUse hook: format and lint each file right after the AI edits it.
// Exit code 2 feeds the lint errors back to the AI so it fixes them immediately.
import { execSync } from 'node:child_process'
import { relative, resolve } from 'node:path'

const input = JSON.parse(
  await new Promise((done) => {
    let data = ''
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => done(data || '{}'))
  })
)

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const filePath = input.tool_input?.file_path
if (!filePath) process.exit(0)

const file = relative(root, resolve(filePath))
if (file.startsWith('..') || file.includes('node_modules')) process.exit(0)

const run = (command) => execSync(command, { cwd: root, encoding: 'utf8', stdio: 'pipe' })

try {
  if (/\.(ts|tsx|js|mjs|cjs|json|css|md|ya?ml)$/.test(file)) {
    run(`pnpm exec prettier --write --ignore-unknown "${file}"`)
  }
  if (/\.(ts|tsx|mjs)$/.test(file)) {
    run(`pnpm exec eslint "${file}"`)
  }
} catch (error) {
  process.stderr.write(`Lint failed for ${file}:\n${error.stdout ?? ''}${error.stderr ?? ''}`)
  process.exit(2)
}
