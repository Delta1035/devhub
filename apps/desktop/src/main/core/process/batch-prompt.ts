import type { RunOutputSnapshot } from '@devhub/shared'
import { stripAnsi } from '../text/ansi'

/**
 * When Ctrl+C interrupts a Windows `.cmd` shim (npm.cmd, yarn.cmd…), cmd.exe asks
 * "Terminate batch job (Y/N)?" (localized, e.g. 终止批处理操作吗(Y/N)?) and waits. The program
 * itself has already stopped; without an answer the run would sit until the force-kill
 * timeout. Every localization ends with "(Y/N)?".
 */
const batchPrompt = /\(Y\/N\)\?\s*$/i
const pollMs = 100

/**
 * Watches output that arrives after the interrupt and answers the prompt once with "Y".
 * Only new output counts, so a program's own earlier "(Y/N)?" is never answered by DevHub.
 * Returns a function that stops watching.
 */
export function answerBatchPrompt(
  snapshot: () => RunOutputSnapshot,
  write: (data: string) => void
): () => void {
  const from = snapshot().end
  const timer = setInterval(() => {
    const { data, end } = snapshot()
    const fresh = data.slice(Math.max(0, data.length - (end - from)))
    if (batchPrompt.test(stripAnsi(fresh))) {
      clearInterval(timer)
      write('Y\r')
    }
  }, pollMs)
  return () => clearInterval(timer)
}
