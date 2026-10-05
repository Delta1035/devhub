import { DevhubError, type IpcResult } from '@devhub/shared'

/**
 * Runs an API call and wraps the outcome in the `IpcResult` envelope shared by every transport
 * (IPC and remote HTTP). Expected failures keep their code; anything else becomes `INTERNAL`.
 */
export async function toIpcResult(
  name: string,
  run: () => Promise<unknown>
): Promise<IpcResult<unknown>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    if (error instanceof DevhubError) {
      return { ok: false, error: { code: error.code, message: error.message } }
    }
    console.error(`[api] ${name} failed`, error)
    const detail = error instanceof Error ? error.message : String(error)
    return { ok: false, error: { code: 'INTERNAL', message: `内部错误：${detail}` } }
  }
}
