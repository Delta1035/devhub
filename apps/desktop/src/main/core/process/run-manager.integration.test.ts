import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Project, Script } from '@devhub/shared'
import { systemDeps, writeFileEnsuringDir } from '../fs/system-deps'
import { createShellLocator } from '../shells/shell-locator'
import { createProcessKiller } from './process-killer'
import { nodePtySpawner } from './pty'
import { createRunManager, type RunManager } from './run-manager'

// Spawns a child and records both pids. "stubborn" ignores the polite interrupt in both
// processes so the forced tree kill has to do the work.
const parentScript = `
const { spawn } = require('child_process')
const { writeFileSync } = require('fs')
const stubborn = process.argv[2] === 'stubborn'
const ignore = "process.on('SIGINT', () => {}); process.on('SIGTERM', () => {});"
if (stubborn) {
  process.on('SIGINT', () => {})
  process.on('SIGTERM', () => {})
}
const child = spawn(process.execPath, ['-e', (stubborn ? ignore : '') + 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
writeFileSync('pids.json', JSON.stringify({ parent: process.pid, child: child.pid }))
setInterval(() => {}, 1000)
`

const pidsSchema = z.object({ parent: z.number().int(), child: z.number().int() })

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const waitFor = async <T>(probe: () => Promise<T | undefined>, timeoutMs: number): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe().catch(() => undefined)
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error('timed out')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

describe.runIf(process.platform === 'win32' || process.platform === 'linux')(
  `run manager with real processes (${process.platform})`,
  () => {
    let dir: string
    let manager: RunManager | undefined

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'devhub-run-'))
      await writeFile(join(dir, 'parent.js'), parentScript)
    })

    afterEach(async () => {
      await manager?.dispose()
      await rm(dir, { recursive: true, force: true, maxRetries: 5 })
    })

    /** A manager wired to real PTYs, the real killer and the shells installed here. */
    const createRealManager = (
      mode: 'polite' | 'stubborn',
      graceMs: number,
      command = `"${process.execPath}" parent.js ${mode}`
    ) => {
      const project: Project = {
        id: 'p1',
        name: 'fixture',
        path: dir,
        addedAt: '2026-10-02T00:00:00.000Z'
      }
      const script: Script = {
        id: 'custom:tree',
        name: 'tree',
        source: 'custom',
        command
      }
      const realKiller = createProcessKiller({ platform: process.platform })
      const forceKill = vi.fn(realKiller.forceKill)
      const created = createRunManager({
        scripts: { find: async () => ({ project, script }) },
        projects: { get: async () => project },
        shells: createShellLocator({
          ...systemDeps(process.platform, process.env),
          startupDir: join(dir, '.devhub-shell'),
          writeFile: writeFileEnsuringDir
        }),
        spawn: nodePtySpawner,
        killer: { ...realKiller, forceKill },
        platform: process.platform,
        graceMs
      })
      manager = created
      return { manager: created, forceKill }
    }

    const readPids = () =>
      waitFor(async () => {
        return pidsSchema.parse(JSON.parse(await readFile(join(dir, 'pids.json'), 'utf8')))
      }, 20_000)

    const startTree = async (mode: 'polite' | 'stubborn', graceMs: number) => {
      const { manager, forceKill } = createRealManager(mode, graceMs)
      const run = await manager.start('p1', 'custom:tree')
      const pids = await readPids()
      return { manager, run, forceKill, allPids: [run.pid, pids.parent, pids.child] }
    }

    const expectAllDead = async (pids: number[]): Promise<void> => {
      await waitFor(async () => (pids.every((pid) => !isAlive(pid)) ? true : undefined), 5000)
    }

    it('stops the whole tree with the polite interrupt', async () => {
      const { manager, run, allPids } = await startTree('polite', 10_000)
      expect(allPids.every(isAlive)).toBe(true)

      await manager.stop(run.id)
      await expectAllDead(allPids)
      expect(manager.list()[0]).toMatchObject({ status: 'exited', stopped: true })
    }, 30_000)

    it('force-kills the whole tree when the interrupt is ignored', async () => {
      const { manager, run, forceKill, allPids } = await startTree('stubborn', 500)

      await manager.stop(run.id)
      expect(forceKill).toHaveBeenCalledWith(run.pid)
      await expectAllDead(allPids)
      expect(manager.list()[0]?.status).toBe('exited')
    }, 30_000)

    it.runIf(process.platform === 'win32')(
      'stops an npm script without waiting out the batch-job prompt',
      async () => {
        await writeFile(
          join(dir, 'package.json'),
          JSON.stringify({ scripts: { tree: 'node parent.js polite' } })
        )
        // npm is a .cmd shim: after Ctrl+C cmd asks "Terminate batch job (Y/N)?".
        const { manager, forceKill } = createRealManager('polite', 5000, 'npm run tree')
        const run = await manager.start('p1', 'custom:tree')
        const pids = await readPids()

        const started = Date.now()
        await manager.stop(run.id)
        expect(Date.now() - started).toBeLessThan(4000)
        expect(forceKill).not.toHaveBeenCalled()
        await expectAllDead([run.pid, pids.parent, pids.child])
      },
      40_000
    )

    it('closing a shell ends the commands started inside it', async () => {
      const { manager } = createRealManager('polite', 5000)
      const shell = await manager.startShell('p1')
      expect(shell).toMatchObject({ kind: 'shell', title: '终端 1', status: 'running' })

      // Type a command the way a user would; `node` from PATH works in every shell.
      manager.writeInput(shell.id, 'node parent.js polite\r')
      const pids = await readPids()
      const tree = [shell.pid, pids.parent, pids.child]
      expect(tree.every(isAlive)).toBe(true)

      await manager.stop(shell.id)
      await expectAllDead(tree)
      expect(manager.list()[0]).toMatchObject({ status: 'exited', stopped: true })
    }, 40_000)
  }
)
