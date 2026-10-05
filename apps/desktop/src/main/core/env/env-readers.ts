import { execFile, spawn } from 'child_process'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Startup files that print endlessly must not exhaust memory.
const maxShellOutput = 8 * 1024 * 1024

/**
 * `reg query <key>` output. reg.exe writes in the console code page, which mangles
 * non-ASCII paths, so it runs in a cmd whose code page is switched to UTF-8 first.
 * `key` is one of DevHub's constants, never user input. The programs are addressed by full
 * path: the PATH this is meant to repair may be unusable.
 */
export async function readRegistryKey(key: string, env: Record<string, string>): Promise<string> {
  const system32 = path.win32.join(env.SystemRoot ?? 'C:\\Windows', 'System32')
  const program = (name: string): string => path.win32.join(system32, name)
  const { stdout } = await execFileAsync(
    program('cmd.exe'),
    [
      '/d',
      '/s',
      '/c',
      `""${program('chcp.com')}" 65001 >nul & "${program('reg.exe')}" query "${key}""`
    ],
    { env, windowsHide: true, windowsVerbatimArguments: true }
  )
  return stdout
}

/**
 * Runs `command` in an interactive login shell (`-ilc`), so it sees what a terminal would:
 * `.bashrc` / `.zshrc` included, where nvm and similar tools set up PATH. Resolves with stdout.
 */
export function runInLoginShell(
  shell: string,
  command: string,
  env: Record<string, string>,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Detached into its own session, so the interactive shell cannot take over the terminal
    // DevHub was started from, and the whole group can be killed on timeout.
    const child = spawn(shell, ['-ilc', command], {
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const chunks: Buffer[] = []
    let size = 0
    const fail = (error: Error): void => {
      clearTimeout(timer)
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          // Already gone.
        }
      }
      reject(error)
    }
    const timer = setTimeout(
      () => fail(new Error(`${shell} did not finish within ${timeoutMs} ms`)),
      timeoutMs
    )
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxShellOutput)
        fail(new Error(`${shell} printed more than ${maxShellOutput} bytes`))
      else chunks.push(chunk)
    })
    child.once('error', fail)
    child.once('close', () => {
      clearTimeout(timer)
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}
