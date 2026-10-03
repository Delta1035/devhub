import { spawnSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const severities = ['info', 'low', 'moderate', 'high', 'critical']
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ')

export function auditCommand(platform = process.platform) {
  // The Windows command is static: no report or environment values enter shell code.
  return platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', 'pnpm audit --json']]
    : ['pnpm', ['audit', '--json']]
}

export function auditSummary(result) {
  if (result.error) throw result.error
  if (![0, 1].includes(result.status) || result.signal) {
    throw new Error(`Dependency audit process failed: ${result.stderr || result.status}`)
  }
  const report = JSON.parse(result.stdout)
  const counts = report?.metadata?.vulnerabilities
  if (
    !isObject(report) ||
    report.error ||
    !isObject(report.advisories) ||
    !isObject(counts) ||
    !severities.every((severity) => Number.isInteger(counts[severity]) && counts[severity] >= 0)
  )
    throw new Error('Dependency audit returned an invalid report or registry error')
  const advisories = Object.values(report.advisories)
  if (result.status === 1 && advisories.length === 0) {
    throw new Error('Dependency audit failed without reporting advisories')
  }
  const lines = [
    '## Dependency audit',
    '',
    severities.map((severity) => `${severity}: ${counts[severity]}`).join(', '),
    '',
    'Findings are informational; no advisories are hidden or exempted. Registry errors fail this job.',
    '',
    '| Package | Severity | Advisory | Dependency paths |',
    '| --- | --- | --- | --- |'
  ]
  for (const advisory of advisories) {
    if (
      !isObject(advisory) ||
      typeof advisory.module_name !== 'string' ||
      !severities.includes(advisory.severity) ||
      !/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(advisory.github_advisory_id) ||
      !Array.isArray(advisory.findings) ||
      !advisory.findings.every(
        (finding) =>
          isObject(finding) &&
          Array.isArray(finding.paths) &&
          finding.paths.every((path) => typeof path === 'string')
      )
    )
      throw new Error('Dependency audit returned an invalid advisory')
    const paths = advisory.findings
      .flatMap((finding) => finding.paths)
      .map(escape)
      .join('<br>')
    const id = advisory.github_advisory_id
    lines.push(
      `| ${escape(advisory.module_name)} | ${advisory.severity} | [${id}](https://github.com/advisories/${id}) | ${paths} |`
    )
  }
  return `${lines.join('\n')}\n`
}

export function runAudit() {
  const [command, args] = auditCommand()
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  })
  writeFileSync('dependency-audit.json', result.stdout ?? '')
  const summary = auditSummary(result)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log(summary)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runAudit()
