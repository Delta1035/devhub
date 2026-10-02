import { join } from 'path'
import { readOptionalFile } from '../detectors/fs-utils'

/**
 * Best-effort guesses of the port a script will listen on, used to warn before starting it
 * when the port is already taken. A wrong guess only means a missing or extra warning, so
 * the rules stay simple: explicit flags first, then well-known dev-server defaults.
 */

// `--port 3000`, `--port=3000`, `-p 3000`, `PORT=3000`.
const explicitPort = /(?:--port[= ]|(?:^|\s)-p\s+|\bPORT=)(\d{2,5})\b/

/** Default ports of dev servers, keyed by the tool and (optionally) its subcommand. */
const toolDefaults: { tool: string; subcommands?: string[]; port: number }[] = [
  { tool: 'vite', subcommands: ['', 'dev', 'serve'], port: 5173 },
  { tool: 'vite', subcommands: ['preview'], port: 4173 },
  { tool: 'next', subcommands: ['dev', 'start'], port: 3000 },
  { tool: 'nuxt', subcommands: ['dev', 'preview', 'start'], port: 3000 },
  { tool: 'nuxi', subcommands: ['dev', 'preview'], port: 3000 },
  { tool: 'react-scripts', subcommands: ['start'], port: 3000 },
  { tool: 'vue-cli-service', subcommands: ['serve'], port: 8080 },
  { tool: 'webpack', subcommands: ['serve'], port: 8080 },
  { tool: 'webpack-dev-server', port: 8080 },
  { tool: 'ng', subcommands: ['serve'], port: 4200 },
  { tool: 'astro', subcommands: ['dev', 'preview'], port: 4321 }
]

const validPort = (port: number): boolean => Number.isInteger(port) && port >= 1 && port <= 65535

/** Ports of an npm script body such as `vite --port 5174` or `cross-env NODE_ENV=dev next dev`. */
export function inferNpmPorts(body: string): number[] {
  const ports = new Set<number>()
  // Each command of a chain (`a && b`, `a; b`) is checked on its own.
  for (const segment of body.split(/&&|\|\||;/)) {
    const explicit = explicitPort.exec(segment)
    if (explicit?.[1] && validPort(Number(explicit[1]))) {
      ports.add(Number(explicit[1]))
      continue
    }
    const words = segment.trim().split(/\s+/)
    for (const [index, word] of words.entries()) {
      const tool = word.split('/').pop() ?? word // node_modules/.bin/vite → vite
      const subcommand = words[index + 1]?.startsWith('-') ? '' : (words[index + 1] ?? '')
      const match = toolDefaults.find(
        (entry) =>
          entry.tool === tool && (!entry.subcommands || entry.subcommands.includes(subcommand))
      )
      if (match) {
        ports.add(match.port)
        break
      }
    }
  }
  return [...ports]
}

const springDefaultPort = 8080
// `server.port=8081`, `server.port: ${PORT:8081}` (the fallback after ':' is used).
const propertiesPort = /^\s*server\.port\s*[=:]\s*(?:\$\{[^:}]+:)?(\d+)/m
// `server:` followed (indented, before the next top-level key) by `port: 8081`.
const yamlPort = /^server:\s*\n(?:[ \t]+.*\n)*?[ \t]+port:\s*["']?(?:\$\{[^:}]+:)?(\d+)/m

/** The port of a Spring Boot app, from its application.properties / .yml, else 8080. */
export async function readSpringPort(projectDir: string): Promise<number> {
  const resources = join(projectDir, 'src', 'main', 'resources')
  const properties = await readOptionalFile(join(resources, 'application.properties')).catch(
    () => null
  )
  const fromProperties = properties && propertiesPort.exec(properties)?.[1]
  if (fromProperties && validPort(Number(fromProperties))) return Number(fromProperties)

  for (const file of ['application.yml', 'application.yaml']) {
    const yaml = await readOptionalFile(join(resources, file)).catch(() => null)
    const fromYaml = yaml && yamlPort.exec(`${yaml}\n`)?.[1]
    if (fromYaml && validPort(Number(fromYaml))) return Number(fromYaml)
  }
  return springDefaultPort
}
