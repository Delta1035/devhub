import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions, requiredGlibc, supportedGlibc } from './verify-linux-package.mjs'

test('compares dotted numeric versions', () => {
  assert.equal(compareVersions('2.35', '2.35'), 0)
  assert.equal(compareVersions('2.9', '2.35'), -1)
  assert.equal(compareVersions('2.42', '2.35'), 1)
  assert.equal(compareVersions('2.35.1', '2.35'), 1)
})

test('finds the newest required GLIBC symbol', () => {
  assert.equal(requiredGlibc('GLIBC_2.2.5\0GLIBC_2.34\0GLIBC_2.17'), '2.34')
  assert.equal(requiredGlibc('no versioned symbols'), null)
})

test('keeps the Linux build compatible with Ubuntu 22.04', () => {
  assert.equal(supportedGlibc, '2.35')
})
