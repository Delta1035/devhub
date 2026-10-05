import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseCommit, readCommits } from './commit-msg.mjs'

export const changelogHeader = `# Changelog

User-facing changes in each DevHub release. \`pnpm release\` generates each section from the
Conventional Commits since the previous tag (\`scripts/changelog.mjs\`), and the Release workflow
uses it as the GitHub Release notes.
`

// Only these types reach users; docs, tests, refactors and chores stay out of the notes.
const groups = [
  ['Features', 'feat'],
  ['Fixes', 'fix'],
  ['Performance', 'perf']
]
const headingPattern = /^## (v\S+)/

const entry = ({ hash, commit }) =>
  `- ${commit.scope ? `**${commit.scope}:** ` : ''}${commit.subject} (${hash.slice(0, 7)})`

/** Renders the section for one release from its commits (oldest first). */
export function renderSection(tag, date, commits) {
  const parsed = commits
    .map(({ hash, message }) => ({ hash, commit: parseCommit(message) }))
    .filter(({ commit }) => commit !== null)
    .reverse()
  const blocks = []
  const breaking = parsed.filter(({ commit }) => commit.breaking)
  if (breaking.length > 0) blocks.push(['Breaking Changes', breaking])
  for (const [title, type] of groups) {
    const items = parsed.filter(({ commit }) => commit.type === type && !commit.breaking)
    if (items.length > 0) blocks.push([title, items])
  }
  const lines = [`## ${tag} - ${date}`, '']
  if (blocks.length === 0) lines.push('No user-facing changes.', '')
  for (const [title, items] of blocks) lines.push(`### ${title}`, '', ...items.map(entry), '')
  return lines.join('\n')
}

/** Inserts a section above the newest one; refuses to add a release twice. */
export function prependSection(changelog, section) {
  const tag = headingPattern.exec(section)[1]
  const lines = (changelog || changelogHeader).replace(/\r\n/g, '\n').split('\n')
  if (lines.some((line) => headingPattern.exec(line)?.[1] === tag)) {
    throw new Error(`CHANGELOG.md already has a section for ${tag}`)
  }
  const index = lines.findIndex((line) => headingPattern.test(line))
  if (index === -1) return `${lines.join('\n').trimEnd()}\n\n${section.trimEnd()}\n`
  lines.splice(index, 0, ...section.trimEnd().split('\n'), '')
  return lines.join('\n')
}

/** Returns the body of a release's section (without its heading), or null when it is missing. */
export function extractSection(changelog, tag) {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex((line) => headingPattern.exec(line)?.[1] === tag)
  if (start === -1) return null
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line))
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim()
}

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  return result
}

export const today = (now = new Date()) =>
  [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-')

/**
 * Adds the section for `version` (commits since the latest v* tag) to CHANGELOG.md and stages
 * it, so `pnpm release` includes it in the release commit.
 */
export function releaseChangelog({ cwd, version, date = today() }) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version ?? '')) {
    throw new Error(`Invalid version "${version}"`)
  }
  const previous = git(['describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD'], cwd)
  const range = previous.status === 0 ? `${previous.stdout.trim()}..HEAD` : 'HEAD'
  const file = join(cwd, 'CHANGELOG.md')
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const section = renderSection(`v${version}`, date, readCommits(range, cwd))
  writeFileSync(file, prependSection(current, section))
  const added = git(['add', '--', 'CHANGELOG.md'], cwd)
  if (added.status !== 0) throw new Error(`git add CHANGELOG.md failed: ${added.stderr.trim()}`)
  return section
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const usage = `Usage:
  node scripts/changelog.mjs release [version]   add and stage the section (version defaults to npm_package_version)
  node scripts/changelog.mjs notes <tag>          print a release's section for the GitHub Release`

/** Runs the CLI and returns its exit code. */
export function main(args, cwd = root, stdout = process.stdout) {
  const [command, value] = args
  if (command === 'release') {
    stdout.write(releaseChangelog({ cwd, version: value ?? process.env.npm_package_version }))
    return 0
  }
  if (command === 'notes' && value) {
    const file = join(cwd, 'CHANGELOG.md')
    const notes = existsSync(file) ? extractSection(readFileSync(file, 'utf8'), value) : null
    if (notes === null) {
      console.error(`CHANGELOG.md has no section for ${value}`)
      return 1
    }
    stdout.write(`${notes}\n`)
    return 0
  }
  console.error(usage)
  return 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2))
}
