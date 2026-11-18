import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/main/**/*.test.ts', 'src/renderer/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts'],
          environment: 'node'
        }
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          environment: 'node',
          testTimeout: 20_000
        }
      }
    ]
  }
})
