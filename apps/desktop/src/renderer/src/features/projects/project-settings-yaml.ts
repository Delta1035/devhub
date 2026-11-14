export const defaultYamlContent = `# 项目级自定义配置 .devhub.yaml
scripts:
  seed:
    command: node scripts/seed.js
    port: 5432
    health: { tcp: 5432 }
  dev:mock:
    command: pnpm run dev:mock
    port: 5174
    env: { VITE_MOCK: "1" }`

export interface ParsedYamlScript {
  name: string
  command: string
}

export function parseYamlScripts(yamlContent: string): ParsedYamlScript[] {
  const parsedItems: ParsedYamlScript[] = []
  const scriptMatch = yamlContent.match(/scripts:([\s\S]*)/)
  if (scriptMatch?.[1]) {
    const body = scriptMatch[1]
    const scriptBlocks = body.split(/\n(?=\s{2}[a-zA-Z0-9_:-]+:)/)
    for (const b of scriptBlocks) {
      const nameM = b.match(/^\s{2}([a-zA-Z0-9_:-]+):/)
      const cmdM = b.match(/command:\s*(.+)/)
      const name = nameM?.[1]
      const command = cmdM?.[1]
      if (name && command) {
        parsedItems.push({ name, command: command.trim() })
      }
    }
  }
  return parsedItems
}
