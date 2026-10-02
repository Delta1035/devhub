/**
 * Splits a command-line argument string the way users type it: whitespace separates
 * arguments, double quotes group text that contains spaces (`--rcfile "C:\My Files\x"`).
 * Backslashes are kept as-is, so Windows paths need no escaping.
 */
export function splitArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quoted = false
  let started = false
  for (const char of input) {
    if (char === '"') {
      quoted = !quoted
      started = true
    } else if (!quoted && /\s/.test(char)) {
      if (started) args.push(current)
      current = ''
      started = false
    } else {
      current += char
      started = true
    }
  }
  if (started) args.push(current)
  return args
}

/** The inverse of splitArgs: quotes arguments that contain whitespace or are empty. */
export function joinArgs(args: string[]): string {
  return args.map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg)).join(' ')
}
