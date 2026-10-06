import { describe, expect, it } from 'vitest'
import { LogText } from './log-text'

function render(...chunks: string[]): string {
  const log = new LogText()
  chunks.forEach((chunk) => log.append(chunk))
  return log.text
}

describe('LogText', () => {
  it('strips colors and keeps line breaks', () => {
    expect(render('\u001b[32mready\u001b[0m in 300 ms\r\n', 'next')).toBe('ready in 300 ms\nnext')
  })

  it('rewrites the current line on a lone carriage return', () => {
    expect(render('build\n10%\r50%\r100%\ndone')).toBe('build\n100%\ndone')
  })

  it('keeps CRLF split across chunks', () => {
    expect(render('one\r', '\ntwo')).toBe('one\ntwo')
  })

  it('waits for an escape sequence split across chunks', () => {
    const log = new LogText()
    log.append('a\u001b[3')
    expect(log.text).toBe('a')
    log.append('1mb')
    expect(log.text).toBe('ab')
  })

  it('reads cursor moves from Windows ConPTY as line breaks, without its blank screen', () => {
    // Recorded from `npm run tick` on Windows: ConPTY paints a blank screen, homes the cursor,
    // and moves to a row instead of printing a line break.
    const output =
      '\u001b[?25l\u001b[2J\u001b[m\u001b[H\r\n\r\n\r\n\r\n\u001b[H\u001b]0;npm run tick\u0007' +
      '\r\n> tick\r\n> node tick.js\u001b[5;1H\u001b[?25h\u001b[32m[14:01:11] \u001b[m第 1 次\r\n'
    expect(render(output)).toBe('> tick\n> node tick.js\n[14:01:11] 第 1 次\n')
  })

  it('keeps a cursor move split across chunks', () => {
    expect(render('one\u001b[5;', '1Htwo')).toBe('one\ntwo')
  })

  it('drops whole old lines past the cap', () => {
    const log = new LogText()
    const line = 'x'.repeat(1023) + '\n'
    for (let i = 0; i < 200; i++) log.append(line)
    log.append('tail')
    expect(log.text.length).toBeLessThanOrEqual(128 * 1024 + 4)
    expect(log.text.startsWith('x')).toBe(true)
    expect(log.text.split('\n')[0]).toHaveLength(1023)
    expect(log.text.endsWith('\ntail')).toBe(true)
  })
})
