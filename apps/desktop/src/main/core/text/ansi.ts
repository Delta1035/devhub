// Built from a string so no control character appears in a regex literal.
const esc = String.fromCharCode(27)
const bel = String.fromCharCode(7)
const ansiPattern = new RegExp(
  `${esc}\\[[0-?]*[ -/]*[@-~]|${esc}\\][^${bel}${esc}]*(?:${bel}|${esc}\\\\)|${esc}[@-Z\\\\-_]`,
  'g'
)

/** Removes ANSI escape sequences (colors, cursor moves, titles) so plain text can be matched. */
export function stripAnsi(text: string): string {
  return text.replace(ansiPattern, '')
}
