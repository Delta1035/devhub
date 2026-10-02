import { chmod, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isExecutable, resolveWrapper } from './fs-utils'

const maven = { win32: 'mvnw.cmd', posix: 'mvnw', fallback: 'mvn' }

describe('resolveWrapper', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devhub-wrapper-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const wrapper = (name: string) => writeFile(join(dir, name), '#!/bin/sh\n')

  it('runs an executable POSIX wrapper directly', async () => {
    await wrapper('mvnw')
    await expect(resolveWrapper(dir, 'linux', maven, async () => true)).resolves.toBe('./mvnw')
  })

  it('runs a POSIX wrapper without the executable bit through sh', async () => {
    await wrapper('mvnw')
    await expect(resolveWrapper(dir, 'linux', maven, async () => false)).resolves.toBe('sh ./mvnw')
  })

  it('falls back to the tool on PATH without a wrapper', async () => {
    await expect(resolveWrapper(dir, 'linux', maven)).resolves.toBe('mvn')
    await expect(resolveWrapper(dir, 'win32', maven)).resolves.toBe('mvn')
  })

  it('uses the .cmd wrapper on Windows without checking permissions', async () => {
    await wrapper('mvnw.cmd')
    await expect(resolveWrapper(dir, 'win32', maven, async () => false)).resolves.toBe('mvnw.cmd')
  })

  // Permission bits only exist on POSIX; Windows grants execute to any existing file.
  it.runIf(process.platform !== 'win32')('reads the real executable bit', async () => {
    await wrapper('mvnw')
    await chmod(join(dir, 'mvnw'), 0o644)
    await expect(isExecutable(join(dir, 'mvnw'))).resolves.toBe(false)
    await expect(resolveWrapper(dir, 'linux', maven)).resolves.toBe('sh ./mvnw')
    await chmod(join(dir, 'mvnw'), 0o755)
    await expect(resolveWrapper(dir, 'linux', maven)).resolves.toBe('./mvnw')
  })
})
