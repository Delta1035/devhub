import { execFile, type ChildProcess } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { dirname } from 'path'
import type { ElectronApplication, TestInfo } from '@playwright/test'

/** Playwright destroys app.process() after close, so retain the child from launch. */
export async function closeRunningApps(
  launched: { app: Pick<ElectronApplication, 'close'>; child: ChildProcess }[]
): Promise<void> {
  const errors: unknown[] = []
  for (const { app, child } of launched) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    try {
      await app.close()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'Failed to close Electron applications')
}

/** Capture evidence before Playwright's overall timeout interrupts a stuck close. */
export function trackAppDiagnostics(
  app: ElectronApplication,
  testInfo: TestInfo,
  index: number
): () => Promise<void> {
  const child = app.process()
  let output = ''
  const record = (source: string, chunk: Buffer) => {
    output = `${output}${new Date().toISOString()} ${source}: ${chunk.toString()}`.slice(-512_000)
  }
  child.stdout?.on('data', (chunk: Buffer) => record('stdout', chunk))
  child.stderr?.on('data', (chunk: Buffer) => record('stderr', chunk))
  let attached = false
  const save = async (reason: string) => {
    const path = testInfo.outputPath(`electron-${index}.log`)
    // Register first: the artifact still survives if the test times out during collection.
    if (!attached) {
      testInfo.attachments.push({ name: `electron-${index}`, path, contentType: 'text/plain' })
      attached = true
    }
    const state = JSON.stringify({
      reason,
      pid: child.pid,
      exitCode: child.exitCode,
      signalCode: child.signalCode,
      killed: child.killed,
      stdoutClosed: child.stdout?.destroyed,
      stderrClosed: child.stderr?.destroyed
    })
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${state}\n${output}`)
    const processes = await processSnapshot()
    await writeFile(path, `${state}\n${output}\nProcess snapshot:\n${processes}`)
  }
  const close = app.close.bind(app)
  app.close = async () => {
    const timer = setTimeout(() => {
      void save('app.close pending for 10 seconds').catch((error: unknown) => {
        console.error('Unable to save Electron close diagnostics', error)
      })
    }, 10_000)
    try {
      await close()
    } catch (error) {
      await save(`app.close failed: ${String(error)}`).catch((diagnosticError: unknown) => {
        console.error('Unable to save Electron failure diagnostics', diagnosticError)
      })
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
  return () => save('test failed')
}

function processSnapshot(): Promise<string> {
  const command = process.platform === 'win32' ? 'powershell.exe' : 'ps'
  const args =
    process.platform === 'win32'
      ? [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress'
        ]
      : ['-eo', 'pid,ppid,stat,comm']
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 5000, windowsHide: true }, (error, stdout, stderr) => {
      resolve(error ? `${String(error)}\n${stderr}\n${stdout}` : stdout)
    })
  })
}
