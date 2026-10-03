// Built from strings so no control characters appear in regular-expression literals.
const esc = String.fromCharCode(27)
const bel = String.fromCharCode(7)
const ansiPattern = new RegExp(
  `${esc}\\[[0-?]*[ -/]*[@-~]|${esc}\\][^${bel}${esc}]*(?:${bel}|${esc}\\\\)|${esc}[@-Z\\\\-_]`,
  'g'
)

/** Removes terminal colors, cursor commands and titles for plain-text log viewing. */
export function stripAnsi(text: string): string {
  return text.replace(ansiPattern, '')
}
