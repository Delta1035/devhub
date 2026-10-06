import { stripAnsi } from '@devhub/shared'

/** Long logs are slow to lay out in a single `Text`; the desktop keeps the full 512 KB. */
const maxLength = 128 * 1024

/** Cursor position (CUP / HVP), e.g. `ESC[5;1H`. Windows ConPTY uses it in place of line breaks. */
const cursorMove = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[Hf]`, 'g')

/**
 * Turns a run's terminal output into plain text for a log view. Colors and cursor commands are
 * removed; a lone carriage return (progress bars, spinners) rewrites the current line as a
 * terminal would. A cursor move ends the current line and drops the blank lines it would jump
 * back over (ConPTY paints a blank screen first). Chunks may split anywhere, including between
 * `\r` and `\n` or inside an escape sequence, so unfinished pieces wait for the next chunk.
 */
export class LogText {
  private done = ''
  private line = ''
  private pending = ''

  get text(): string {
    return this.done + this.line
  }

  append(chunk: string): void {
    const input = this.pending + chunk
    const cut = unfinishedTail(input)
    this.pending = input.slice(cut)
    const ready = input.slice(0, cut)
    let last = 0
    for (const match of ready.matchAll(cursorMove)) {
      this.write(ready.slice(last, match.index))
      this.moveCursor()
      last = match.index + match[0].length
    }
    this.write(ready.slice(last))
    if (this.done.length > maxLength) {
      const start = this.done.indexOf('\n', this.done.length - maxLength)
      this.done = this.done.slice(start + 1)
    }
  }

  private write(text: string): void {
    const parts = stripAnsi(text).replace(/\r\n/g, '\n').split('\n')
    parts.forEach((part, index) => {
      // A log never starts with blank lines.
      if (index > 0 && (this.done || this.line)) {
        this.done += this.line + '\n'
        this.line = ''
      }
      const overwrite = part.lastIndexOf('\r')
      if (overwrite >= 0) this.line = part.slice(overwrite + 1)
      else this.line += part
    })
  }

  private moveCursor(): void {
    if (this.line) {
      this.done += this.line + '\n'
      this.line = ''
    }
    this.done = this.done.replace(/\n{2,}$/, '\n')
    if (this.done === '\n') this.done = ''
  }
}

/** Where a trailing `\r` or an unterminated escape sequence starts; `input.length` if none. */
function unfinishedTail(input: string): number {
  if (input.endsWith('\r')) return input.length - 1
  const esc = input.lastIndexOf('\u001b')
  // An escape sequence is at most a few dozen characters; anything longer is not one.
  if (esc < 0 || input.length - esc > 64) return input.length
  return stripAnsi(input.slice(esc)) === input.slice(esc) ? esc : input.length
}
