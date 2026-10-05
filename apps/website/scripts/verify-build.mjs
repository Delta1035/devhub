// Checks the built site for regressions a successful build does not catch:
// Chinese search and the redirects kept for the old /zh/ addresses. Run after `build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveConfig } from 'vitepress'

const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url))
const failures = []

// Search the built index the way the browser does: VitePress's own MiniSearch, the site's
// options, and functions rebuilt from their source text as VitePress ships them.
const { site } = await resolveConfig(fileURLToPath(new URL('..', import.meta.url)), 'build')
const { default: MiniSearch } = await import(
  pathToFileURL(createRequire(import.meta.resolve('vitepress')).resolve('minisearch')).href
)
const asShipped = (options = {}) =>
  Object.fromEntries(
    Object.entries(options).map(([key, value]) => [
      key,
      typeof value === 'function' ? new Function(`return ${value.toString()}`)() : value
    ])
  )
const { options, searchOptions } = site.themeConfig.search.options.miniSearch ?? {}

async function loadIndex(locale) {
  const chunks = join(dist, 'assets', 'chunks')
  const file = readdirSync(chunks).find((name) => name.startsWith(`@localSearchIndex${locale}.`))
  if (!file) throw new Error(`no search index for locale "${locale}"`)
  const { default: json } = await import(pathToFileURL(join(chunks, file)).href)
  // Mirrors VPLocalSearchBox.vue.
  return MiniSearch.loadJSON(json, {
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    searchOptions: {
      fuzzy: 0.2,
      prefix: true,
      boost: { title: 4, text: 2, titles: 1 },
      ...asShipped(searchOptions)
    },
    ...asShipped(options)
  })
}

// Without word segmentation a Chinese sentence was indexed as one term and「日志」found nothing.
const searches = {
  root: {
    日志: '/devhub/guide/',
    端口: '/devhub/guide/devhub-yaml#端口',
    批量任务: '/devhub/guide/batch-tasks'
  },
  en: { logs: '/devhub/en/guide/', port: '/devhub/en/guide/devhub-yaml' }
}
for (const [locale, queries] of Object.entries(searches)) {
  const index = await loadIndex(locale)
  for (const [query, expected] of Object.entries(queries)) {
    const ids = index.search(query).map((result) => result.id)
    if (!ids.some((id) => id.startsWith(expected))) {
      failures.push(
        `search "${query}" (${locale}) has no result under ${expected}: ${ids.slice(0, 3)}`
      )
    }
  }
}

const redirects = {
  'zh/index.html': '/devhub/',
  'zh/guide/getting-started.html': '/devhub/guide/getting-started',
  'zh/guide/devhub-yaml.html': '/devhub/guide/devhub-yaml',
  'zh/guide/batch-tasks.html': '/devhub/guide/batch-tasks'
}
for (const [page, target] of Object.entries(redirects)) {
  const file = join(dist, page)
  if (!existsSync(file)) {
    failures.push(`missing redirect page ${page}`)
    continue
  }
  if (!readFileSync(file, 'utf8').includes(`url=${target}"`)) {
    failures.push(`${page} does not redirect to ${target}`)
  }
  const targetPage = join(
    dist,
    ...target
      .replace(/^\/devhub\//, '')
      .split('/')
      .filter(Boolean)
  )
  if (!existsSync(target.endsWith('/') ? join(targetPage, 'index.html') : `${targetPage}.html`)) {
    failures.push(`${page} redirects to ${target}, which was not built`)
  }
}

if (failures.length > 0) {
  console.error(`Website build check failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('Website build check passed.')
