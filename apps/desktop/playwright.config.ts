import { defineConfig } from '@playwright/test'

/**
 * E2E tests drive the built app (`out/`, see the `e2e` script) through Playwright's Electron
 * support. Serial on purpose: every test launches its own Electron instance.
 */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  outputDir: 'test-results'
})
