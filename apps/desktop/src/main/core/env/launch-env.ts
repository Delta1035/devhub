import { randomBytes } from 'crypto'
import { parseShellEnv, shellEnvCommand } from './shell-env'
import { parseRegistryValues, windowsLaunchEnv } from './windows-env'

/** The environment for a process DevHub starts: scripts, shells, editors, system terminals. */
export type EnvResolver = () => Promise<Record<string, string>>

export interface LaunchEnvDeps {
  platform: NodeJS.Platform
  /** DevHub's own environment, inherited from whoever started it. */
  env: NodeJS.ProcessEnv
  /** `reg query <key>` output (Windows), run with the inherited environment. */
  readRegistryKey: (key: string, env: Record<string, string>) => Promise<string>
  /** Stdout of `command` run in an interactive login shell (Linux / macOS). */
  runInLoginShell: (
    shell: string,
    command: string,
    env: Record<string, string>,
    timeoutMs: number
  ) => Promise<string>
  log?: (message: string, error: unknown) => void
  now?: () => number
  newMarker?: () => string
}

const machineKey = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'
const userKey = 'HKCU\\Environment'
// Long enough that a group starting many scripts reads the registry once.
const registryCacheMs = 5000
const shellTimeoutMs = 10_000

/**
 * Resolves the user's real environment instead of trusting the inherited one (ADR 0024).
 * Windows re-reads the persistent variables from the registry, briefly cached, so tools
 * installed while DevHub runs are found too. Linux / macOS capture the interactive login
 * shell's environment once per session: GUI sessions lack what `.bashrc` / `.zshrc` set up.
 * Any failure falls back to the inherited environment.
 */
export function createLaunchEnvResolver({
  platform,
  env,
  readRegistryKey,
  runInLoginShell,
  log = (message, error) => console.error(`[core] ${message}`, error),
  now = Date.now,
  newMarker = () => `__DEVHUB_ENV_${randomBytes(8).toString('hex')}__`
}: LaunchEnvDeps): EnvResolver {
  const inherited = definedEnv(env)

  if (platform === 'win32') {
    const readKey = (key: string): Promise<string> =>
      readRegistryKey(key, inherited).catch((error: unknown) => {
        log(`reading ${key} failed`, error)
        return ''
      })
    const read = async (): Promise<Record<string, string>> => {
      const [machine, user] = await Promise.all([readKey(machineKey), readKey(userKey)])
      return windowsLaunchEnv(inherited, parseRegistryValues(machine), parseRegistryValues(user))
    }
    let cached: { at: number; env: Promise<Record<string, string>> } | undefined
    return () => {
      if (!cached || now() - cached.at >= registryCacheMs) cached = { at: now(), env: read() }
      return cached.env
    }
  }

  const capture = async (): Promise<Record<string, string>> => {
    const shell = inherited.SHELL || '/bin/sh'
    const marker = newMarker()
    try {
      const stdout = await runInLoginShell(
        shell,
        shellEnvCommand(marker),
        inherited,
        shellTimeoutMs
      )
      const captured = parseShellEnv(stdout, marker)
      if (captured) return { ...inherited, ...captured }
      log(`${shell} printed no environment`, stdout.slice(0, 200))
    } catch (error) {
      log(`capturing the environment of ${shell} failed`, error)
    }
    return inherited
  }
  let captured: Promise<Record<string, string>> | undefined
  return () => (captured ??= capture())
}

function definedEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) result[key] = value
  }
  return result
}
